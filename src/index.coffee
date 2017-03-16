
require "./global"
module.exports = lotus

assertType = require "assertType"
path = require "path"
fs = require "fsx"

lotus.config = do ->
  configPath = path.join lotus.path, "lotus.config.json"
  if fs.isFile configPath
  then JSON.parse fs.readFile configPath
  else throw Error "Missing global config: '#{configPath}'"

# Returns true if the user wants a module to be ignored.
lotus.isModuleIgnored = require("in-array").bind null, lotus.config.ignoredModules

Object.assign lotus,
  plugins: require "./PluginCache"
  commands: Object.create null
  modulePlugins: []
  moduleMixins: []
  fileMixins: []

# Load the global plugins, then build the 'File' and 'Module' constructors.
loading = do ->
  {plugins, config} = lotus

  unless config.plugins
    return Promise()

  unless Array.isArray config.plugins
    throw TypeError "'config.plugins' must be an Array!"

  options = {global: yes}
  loader = (plugin) ->
    plugin.initCommands lotus.commands
    plugin.initModuleType()
    plugin.initFileType()
    return

  Promise.all config.plugins, (name) ->
    plugins.load name, options, loader

  .then ->
    lotus.File = require "./File"
    lotus.Module = require "./Module"
    lotus.modules = require "./ModuleCache"
    return

lotus.run = (command, options = {}) ->
  assertType command, String
  assertType options, Object.Maybe

  return loading.then ->

    args = command.split " "
    args = args.concat options._ if options._
    command = args.shift()
    options._ = args

    method = lotus.commands[command]
    if method instanceof Function
    then method options
    else throw Error "Invalid command: '#{command}'"
