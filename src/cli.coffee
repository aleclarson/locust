
lotus = require "lotus-require"

{ async } = require "io"
{ isType } = require "type-utils"
{ log, ln, color } = require "lotus-log"

require "./file"
require "./module"

#
# Key bindings
#

# KeyBindings = require "key-bindings"
# keys = KeyBindings
#
#   "c+ctrl": ->
#     log.moat 1
#     log.red "CTRL+C"
#     log.moat 1
#     process.exit 0
#
# keys.stream = process.stdin


#
# Logging configuration
#

log.clear()
log.indent = 2
# log.cursor.isHidden = yes

# require "lotus-repl"
# log.repl.transform = "coffee"

log.moat 1

#
# Parse the terminal input for a command
#

commands =
  watch: require "./watch"

# Default to the 'watch' command.
command = "watch"

for arg in process.argv.slice 2
  if arg[0] isnt "-"
    command = arg
    break


#
# `--help` prints a list of valid commands
#

help = ->
  log.moat 1
  log.indent = 2
  log.green.bold "Commands"
  log.indent = 4
  log ln, Object.keys(commands).join ln
  log.moat 1

return help() if command is "--help"


#
# Plugin startup
#

Config = require "./config"

config = Config lotus.path

log.origin "lotus"
log.yellow "plugins:"
log.moat 0
log.plusIndent 2
log Object.keys(config.plugins).join log.ln
log.popIndent()
log.moat 1

config.loadPlugins (plugin, options) ->
  plugin commands, options

.then ->

  command = commands[command]

  if command?
    process.chdir lotus.path

    if isType command, Function
      command.call()

    else if isType command, String
      require command

    else
      async.throw
        error: Error "'#{color.red command}' must be defined as a Function or String"
        format: simple: yes

  else
    help()
    async.throw
      error: Error "'#{color.red command}' is an invalid command"
      format: simple: yes

.done()
