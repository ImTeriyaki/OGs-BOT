const browser = require('./browser');
const help = require('./help');
const setup = require('./setup');
const welcome = require('./welcome');
const goodbye = require('./goodbye');
const announce = require('./announce');
const { commands: jtcCommands, registerJoinToCreate } = require('./jointocreate');
const autorole = require('./autorole');
const selfroles = require('./selfroles');
const ticket = require('./ticket');
const logs = require('./logs');
const embed = require('./embed');
const refresh = require('./refresh');
const purge = require('./purge');
const slowmode = require('./slowmode');
const lock = require('./lock');
const unlock = require('./unlock');
const user = require('./user');
const serverinfo = require('./serverinfo');
const roleinfo = require('./roleinfo');
const channelinfo = require('./channelinfo');
const avatar = require('./avatar');
const membercount = require('./membercount');
const botinfo = require('./botinfo');
const stats = require('./stats');
const boosts = require('./boosts');
const snipe = require('./snipe');
const editsnipe = require('./editsnipe');
const say = require('./say');
const remind = require('./remind');
const poll = require('./poll');
const inrole = require('./inrole');
const channelcreate = require('./channelcreate');
const rolecreate = require('./rolecreate');
const ping = require('./ping');
const uptime = require('./uptime');
const invite = require('./invite');
const { command: honeypotCommand, registerHoneypot } = require('./honeypot');
const { registerDmMessages } = require('./dm-messages');
const { command: autoforwardCommand, registerAutoForward } = require('./autoforward');

const commands = [
  browser,
  help,
  setup,
  welcome,
  goodbye,
  announce,
  ...jtcCommands,
  autorole,
  selfroles,
  ticket,
  logs,
  embed,
  refresh,
  purge,
  slowmode,
  lock,
  unlock,
  user,
  serverinfo,
  roleinfo,
  channelinfo,
  avatar,
  membercount,
  botinfo,
  stats,
  boosts,
  snipe,
  editsnipe,
  say,
  remind,
  poll,
  inrole,
  channelcreate,
  rolecreate,
  ping,
  uptime,
  invite,
  honeypotCommand,
  autoforwardCommand,
];

module.exports = { commands, registerJoinToCreate, registerHoneypot, registerDmMessages, registerAutoForward };
