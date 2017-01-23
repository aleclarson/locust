
global.lotus = require "lotus-require"
global.isDev = require "isDev"

require "ReactiveVar" # Required for 'Property({ reactive: true })'
require "LazyVar"     # Required for 'Property({ lazy: Function })'

global.Promise = require "Promise"
global.log = require "log"

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
