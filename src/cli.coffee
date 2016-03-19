
require "./global"

log.clear()
log.indent = 2
log.moat 1

commands = {
  watch: __dirname + "/watch"
}

argv = process.argv.slice 2
command = argv[0] ?= "watch"

#
# Plugin startup
#

Config = require "./Config"

global.GlobalConfig = Config lotus.path

log.moat 1
log.green.bold "Global plugins:"
log.moat 0
log.plusIndent 2
log.white Object.keys(GlobalConfig.plugins).join log.ln
log.popIndent()
log.moat 1

process.cli = yes

# Allow global plugins to extend available commands.
GlobalConfig.loadPlugins (plugin, options) ->
  process.options = options
  plugin commands
  process.options = undefined

.then ->
  process.cli = no

  help = ->
    log.moat 1
    log.green.bold "Available commands:"
    log.plusIndent 2
    log.moat 0
    log.white Object.keys(commands).join log.ln
    log.popIndent()
    log.moat 1

  if command is "--help"
    help()
    process.exit()

  modulePath = commands[command]
  assertType modulePath, [ String, Void ]

  unless modulePath?
    help()
    log.moat 1
    log.red "Invalid command: "
    log.white command
    log.moat 1
    process.exit()

  require modulePath

.done()
