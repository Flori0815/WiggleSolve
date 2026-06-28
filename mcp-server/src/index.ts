import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'node:http';
import { session } from './session';
import { handleSessionNew, handleSessionGet, handleAddBody, handleAddGlobalNode, handleAddJoint, handleAddActuator, handleAddSolveLoop, handleUpdateValue, handleRemoveElement } from './tools/build';
import { handleValidateDefinition, handleTestSolve, handleListNodePositions } from './tools/validate';
import { handleListTemplates, handleGetTemplate, handleGetTemplateParams, handleInstantiateTemplate, handleLoadTemplateToSession, handleSaveAsTemplate, handleDeleteTemplate } from './tools/templates';
import { handleMatrixTranslation, handleMatrixIdentity, handleMatrixRotation, handleExplainSession } from './tools/utils';

// ── Embedded HTTP server for SSE / live session bridge ────────────────────────

const port = Number(process.env['WIGGLESOLVE_PORT'] ?? 3001);

const httpServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/session' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(session.getDefinition()));
    return;
  }

  if (req.url === '/session/events' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    session.addSseClient(res);
    req.on('close', () => session.removeSseClient(res));
    res.write(`data: ${JSON.stringify(session.getDefinition())}\n\n`);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(port, () => {
  process.stderr.write(`WiggleSolve MCP session bridge running on http://localhost:${port}\n`);
});

// ── MCP Tools definition ─────────────────────────────────────────────────────

const TOOLS = [
  // Build tools
  { name: 'session_new', description: 'Start a new empty kinematic session. Resets all bodies, joints, actuators and sequence. Connect the web app to http://localhost:3001 to see live updates.', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Name for the kinematic system' }, description: { type: 'string' } }, required: [] } },
  { name: 'session_get', description: 'Return the current session definition JSON.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'add_body', description: 'Add a rigid body with one or more nodes. Each node has an id and a localTransform (16-element column-major SE(3) matrix). Use matrix_translation to compute transforms.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, nodes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, localTransform: { type: 'array', items: { type: 'number' }, minItems: 16, maxItems: 16 } }, required: ['id', 'localTransform'] } } }, required: ['id', 'nodes'] } },
  { name: 'add_global_node', description: 'Add a world-space reference node (e.g. a target position). absoluteTransform is a 16-element column-major SE(3) matrix.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, absoluteTransform: { type: 'array', items: { type: 'number' }, minItems: 16, maxItems: 16 } }, required: ['id', 'absoluteTransform'] } },
  { name: 'add_joint', description: 'Add a joint. type: revolute (rotates) or prismatic (translates). axis: unit vector [x,y,z]. limits: [min, max] in radians (revolute) or meters (prismatic).', inputSchema: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string', enum: ['revolute', 'prismatic'] }, axis: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 }, limits: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } }, required: ['id', 'type', 'axis', 'limits'] } },
  { name: 'add_actuator', description: 'Add an actuator: connects a joint to the bodies it moves. pivotNode is the rotation/translation centre. movingBodies lists every body that moves when this joint actuates.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Must match a joint id' }, type: { type: 'string', enum: ['revolute', 'prismatic'] }, axis: { type: 'string', enum: ['x', 'y', 'z'] }, pivotNode: { type: 'string' }, movingBodies: { type: 'array', items: { type: 'string' } } }, required: ['id', 'type', 'axis', 'pivotNode', 'movingBodies'] } },
  { name: 'add_solve_loop', description: 'Add a CCD (Cyclic Coordinate Descent) solve loop to the sequence. Steps are align_node operations ordered innermost-to-outermost joint.', inputSchema: { type: 'object', properties: { max_iterations: { type: 'number' }, condition: { type: 'object', properties: { type: { type: 'string', enum: ['distance_less_than'] }, nodeA: { type: 'string' }, nodeB: { type: 'string' }, threshold: { type: 'number' } }, required: ['type', 'nodeA', 'nodeB', 'threshold'] }, steps: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['operation'] }, operation: { type: 'object', properties: { type: { type: 'string', enum: ['align_node'] }, effectorNode: { type: 'string' }, targetNode: { type: 'string' }, pivotNode: { type: 'string' }, jointId: { type: 'string' }, movingBodies: { type: 'array', items: { type: 'string' } } }, required: ['type', 'effectorNode', 'targetNode', 'pivotNode', 'jointId', 'movingBodies'] } }, required: ['type', 'operation'] } } }, required: ['max_iterations', 'condition', 'steps'] } },
  { name: 'update_value', description: 'Patch any value in the current session definition using a JSON Pointer path (RFC 6901). Example: /system/joints/0/limits to change joint limits.', inputSchema: { type: 'object', properties: { jsonPointer: { type: 'string' }, value: {} }, required: ['jsonPointer', 'value'] } },
  { name: 'remove_element', description: 'Remove a body, joint, actuator, or global node from the session.', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['body', 'joint', 'actuator', 'globalNode'] }, id: { type: 'string' } }, required: ['type', 'id'] } },
  // Validate / test tools
  { name: 'validate_definition', description: 'Validate the current session against the WiggleSolve schema. Returns validation errors if any.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'test_solve', description: 'Run the IK solver on the current session. Returns {converged, jointValues, nodePositions}.', inputSchema: { type: 'object', properties: { target_position: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3, description: 'Override target [x, y, z] in world units' } }, required: [] } },
  { name: 'list_node_positions', description: 'Return the absolute world-space position of every node in the current session.', inputSchema: { type: 'object', properties: {}, required: [] } },
  // Template tools
  { name: 'list_templates', description: 'List all saved kinematic templates.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_template', description: 'Return the full JSON of a saved template.', inputSchema: { type: 'object', properties: { templateId: { type: 'string' } }, required: ['templateId'] } },
  { name: 'get_template_params', description: 'Return only the parameter schema for a saved template.', inputSchema: { type: 'object', properties: { templateId: { type: 'string' } }, required: ['templateId'] } },
  { name: 'instantiate_template', description: 'Apply parameters to a saved template and return a concrete DemoDefinition JSON.', inputSchema: { type: 'object', properties: { templateId: { type: 'string' }, params: { type: 'object' } }, required: ['templateId'] } },
  { name: 'load_template_to_session', description: 'Instantiate a template into the live session so the 3D view updates immediately.', inputSchema: { type: 'object', properties: { templateId: { type: 'string' }, params: { type: 'object' } }, required: ['templateId'] } },
  { name: 'save_as_template', description: 'Save the current session as a reusable template. Specify which values are user-configurable via parameters and parameterBindings.', inputSchema: { type: 'object', properties: { templateId: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, parameters: { type: 'object' }, parameterBindings: { type: 'object' } }, required: ['templateId', 'parameters', 'parameterBindings'] } },
  { name: 'delete_template', description: 'Delete a saved template.', inputSchema: { type: 'object', properties: { templateId: { type: 'string' } }, required: ['templateId'] } },
  // Utility tools
  { name: 'matrix_translation', description: 'Compute a 16-element column-major SE(3) translation matrix. Use this when building node localTransforms.', inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }, required: ['x', 'y', 'z'] } },
  { name: 'matrix_identity', description: 'Return the 16-element identity matrix.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'matrix_rotation', description: 'Compute a 16-element column-major rotation matrix around x, y, or z by angle in radians.', inputSchema: { type: 'object', properties: { axis: { type: 'string', enum: ['x', 'y', 'z'] }, radians: { type: 'number' } }, required: ['axis', 'radians'] } },
  { name: 'explain_session', description: 'Return a human-readable summary of the current session topology.', inputSchema: { type: 'object', properties: {}, required: [] } },
];

// ── MCP Server ────────────────────────────────────────────────────────────────

void (async () => {
  const server = new Server(
    { name: 'wigglesolve-kinematics', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;

    switch (name) {
      case 'session_new':         return handleSessionNew(a as Parameters<typeof handleSessionNew>[0]);
      case 'session_get':         return handleSessionGet();
      case 'add_body':            return handleAddBody(a as Parameters<typeof handleAddBody>[0]);
      case 'add_global_node':     return handleAddGlobalNode(a as Parameters<typeof handleAddGlobalNode>[0]);
      case 'add_joint':           return handleAddJoint(a as Parameters<typeof handleAddJoint>[0]);
      case 'add_actuator':        return handleAddActuator(a as Parameters<typeof handleAddActuator>[0]);
      case 'add_solve_loop':      return handleAddSolveLoop(a as Parameters<typeof handleAddSolveLoop>[0]);
      case 'update_value':        return handleUpdateValue(a as Parameters<typeof handleUpdateValue>[0]);
      case 'remove_element':      return handleRemoveElement(a as Parameters<typeof handleRemoveElement>[0]);
      case 'validate_definition': return handleValidateDefinition();
      case 'test_solve':          return handleTestSolve(a as Parameters<typeof handleTestSolve>[0]);
      case 'list_node_positions': return handleListNodePositions();
      case 'list_templates':         return handleListTemplates();
      case 'get_template':           return handleGetTemplate(a as Parameters<typeof handleGetTemplate>[0]);
      case 'get_template_params':    return handleGetTemplateParams(a as Parameters<typeof handleGetTemplateParams>[0]);
      case 'instantiate_template':   return handleInstantiateTemplate(a as Parameters<typeof handleInstantiateTemplate>[0]);
      case 'load_template_to_session': return handleLoadTemplateToSession(a as Parameters<typeof handleLoadTemplateToSession>[0]);
      case 'save_as_template':       return handleSaveAsTemplate(a as Parameters<typeof handleSaveAsTemplate>[0]);
      case 'delete_template':        return handleDeleteTemplate(a as Parameters<typeof handleDeleteTemplate>[0]);
      case 'matrix_translation': return handleMatrixTranslation(a as Parameters<typeof handleMatrixTranslation>[0]);
      case 'matrix_identity':    return handleMatrixIdentity();
      case 'matrix_rotation':    return handleMatrixRotation(a as Parameters<typeof handleMatrixRotation>[0]);
      case 'explain_session':    return handleExplainSession();
      default: throw new Error(`Unknown tool: ${name}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
