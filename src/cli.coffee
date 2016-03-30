
require "./global"

lotus.File = require "./File"
lotus.Module = require "./Module"
lotus.Plugin = require "./Plugin"

minimist = require "minimist"

process.cli = yes
process.options = minimist process.argv.slice 2

command = process.options._[0] or "watch"

lotus.Plugin.commands.watch = ->
  require "./watch"

Config = require "./Config"

global.GlobalConfig = Config lotus.path

Q.try ->

  return unless GlobalConfig.plugins

  Q.all sync.map GlobalConfig.plugins, (name) ->

    Q.try ->
      plugin = lotus.Plugin name
      plugin.load()

    .fail (error) ->
      log.moat 1
      log.red "Plugin error: "
      log.white name
      log.moat 0
      log.gray.dim error.stack, " "
      log.moat 1
      process.exit()

  .then ->
    return if process.options._[0]
    return unless process.options.help
    printCommandList()
    process.exit()

.then ->

  runCommand = lotus.Plugin.commands[command]

  if runCommand is undefined
    printCommandList()
    log.moat 1
    log.red "Unknown command: "
    log.white command
    log.moat 1
    process.exit()

  assert (isType runCommand, Function), { command, reason: "The command failed to export a Function!" }
  runCommand()

.done()

printCommandList = ->
  commands = Object.keys lotus.Plugin.commands
  log.moat 1
  log.green "Available commands:"
  log.plusIndent 2
  for command in commands
    log.moat 1
    log.gray.dim "lotus "
    log.white command
  log.popIndent()
  log.moat 1
