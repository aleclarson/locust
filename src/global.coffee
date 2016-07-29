
global.lotus = require "lotus-require"
lotus.register exclude: [ "/node_modules/" ]

require "isDev"

require "ReactiveVar" # Required for 'Property({ reactive: true })'
require "LazyVar"     # Required for 'Property({ lazy: Function })'
require "Event"       # Required for 'Builder::defineEvents'

global.Promise = require "Promise"
global.prompt = require "prompt"
global.repl = require "repl"
global.log = require "log"

#
# Key bindings
#

if process.stdin.setRawMode

  KeyBindings = require "key-bindings"

  keys = KeyBindings

    "c+ctrl": ->
      log.moat 1
      log.red "CTRL+C"
      log.moat 1
      process.exit()

    "x+ctrl": ->
      log.moat 1
      log.red "CTRL+X"
      log.moat 1
      process.exit()

  keys.stream = process.stdin

#
# Error handling
#

setGlobalErrorHandler = (onError) ->
  Promise.onUnhandledRejection onError
  process.on "uncaughtException", onError

setGlobalErrorHandler (error) ->
  lines = error.message.split log.ln
  stack = error.stack.split log.ln
  stack = stack.slice lines.length
  log.moat 1
  log.red "Error: "
  log.white error.message
  log.moat 0
  log.gray.dim stack.join log.ln
  log.moat 1
