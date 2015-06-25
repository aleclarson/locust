
lotus = require "../../../lotus-require"

process.chdir lotus.path

{ log, ln, color } = require "lotus-log"
log.cursor.isHidden = yes
log.clear()
log.moat 1
log.indent = 2

require "lotus-repl"
log.repl.transform = "coffee"

command = process.argv[2] ? "watch"

commands =
  watch: __dirname + "/watch"
  upgrade: __dirname + "/upgrade"

help = ->
  log.moat 1
  log.indent = 2
  log.green.bold "Commands"
  log.indent = 4
  log ln, Object.keys(commands).join ln
  log.moat 1

Config = require "./config"

config = Config process.env.LOTUS_PATH

io = require "io"
{ isType } = require "type-utils"

Q = require "q"
Q.debug = yes
# Q.verbose = yes

config.loadPlugins (plugin, options) ->
  plugin commands, options

.then ->

  command = commands[command]

  if command?
    if isType command, Function then command()
    else if isType command, String then require command
    return

  help()

  if command is "--help"
    process.exit 0

  io.throw
    error: Error "'#{color.red command}' is an invalid command"
    format: simple: yes

.done()
