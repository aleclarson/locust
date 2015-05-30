
require "../../../lotus-require"
{ log, ln, color } = require "lotus-log"

require "lotus-repl"
log.repl.transform = "coffee"
log.cursor.isHidden = yes
log.clear()
log.moat 1

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

log.format config, label: "config = "

config.loadPlugins (plugin, i, done) ->
  log.format Array::slice.call(arguments), label: "arguments = "
  _done = (error) ->
    return done() if !error?
    throw TypeError "'error' must be an Error or undefined." unless error instanceof Error
    format = ->
      stack:
        exclude: ["**/q/q.js", "**/nimble/nimble.js"]
        filter: (frame) -> not (frame.isNode() or frame.isNative() or frame.isEval())
    log.throw { error, format }

  try plugin { commands, config }, _done
  catch error then _done error

.then ->
  return require commands[command] if commands.hasOwnProperty command
  help()
  return process.exit 0 if command is "--help"
  error = Error "'#{color.red command}' is an invalid command"
  log.error error, stack: no, repl: no

.done()
