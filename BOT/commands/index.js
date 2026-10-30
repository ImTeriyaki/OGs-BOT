const commandBrowser = require('./commands');
const setup = require('./setup');
const welcome = require('./welcome');
const goodbye = require('./goodbye');
const announce = require('./announce');
const { commands: jtcCommands, registerJoinToCreate } = require('./jointocreate');
const ticket = require('./ticket');
const logs = require('./logs');
const embed = require('./embed');
const refresh = require('./refresh');
const slowmode = require('./slowmode');
const lock = require('./lock');
const unlock = require('./unlock');
const user = require('./user');
const serverinfo = require('./serverinfo');
const membercount = require('./membercount');
const botinfo = require('./botinfo');
const say = require('./say');
const remind = require('./remind');
const inrole = require('./inrole');
const ping = require('./ping');
const uptime = require('./uptime');
const invite = require('./invite');
const temp = require('./temp');
const verify = require('./verify');
const rust = require('./rust');
const { registerRustWipeWatcher } = rust;
const { command: honeypotCommand, registerHoneypot } = require('./honeypot');
const { command: medalforwardCommand, registerMedalForward } = require('./medalforward');
const { registerDmMessages } = require('./dm-messages');

const commands = [
  commandBrowser,
  setup,
  welcome,
  goodbye,
  announce,
  ...jtcCommands,
  ticket,
  logs,
  embed,
  refresh,
  slowmode,
  lock,
  unlock,
  user,
  serverinfo,
  membercount,
  botinfo,
  say,
  remind,
  inrole,
  ping,
  uptime,
  invite,
  temp,
  verify,
  rust,
  honeypotCommand,
  medalforwardCommand,
];

module.exports = { commands, registerJoinToCreate, registerHoneypot, registerDmMessages, registerMedalForward, registerRustWipeWatcher };
