
require "./global"
module.exports = lotus

SortedArray = require "SortedArray"
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
    return Promise.resolve()

  unless Array.isArray config.plugins
    throw TypeError "'config.plugins' must be an Array!"

  options = {global: yes}
  loader = (plugin) ->

    if commands = plugin.loadCommands()
      Object.assign lotus.commands, commands

    plugin.loadGlobals()
    plugin.loadFileMixin()
    plugin.loadModuleMixin()
    return

  Promise.all config.plugins, (name) ->
    plugins.load name, options, loader

  .then ->
    lotus.File = require "./File"
    lotus.Module = require "./Module"
    lotus.modules = require "./ModuleCache"
    return

lotus.onInit = (callback) ->
  loading.then callback

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

# Crawl a directory for modules.
# For module watching, install `lotus-watch` and call `lotus.watchModules`.
lotus.findModules = (root) ->

  assertType root, String.Maybe
  root ?= lotus.path

  unless path.isAbsolute root
    throw Error "Expected an absolute path: '#{root}'"

  unless fs.isDir root
    throw Error "Expected a directory: '#{root}'"

  mods = SortedArray [], (a, b) ->
    a = a.name.toLowerCase()
    b = b.name.toLowerCase()
    if a > b then 1 else -1

  return loading.then ->

    fs.readDir root
    .forEach (modName) ->
      try mod = lotus.modules.load modName
      mods.insert mod if mod

    return mods.array

