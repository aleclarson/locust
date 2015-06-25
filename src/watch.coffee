
lotus = require "../../../lotus-require"
Path = require "path"
gaze = require "gaze"
semver = require "semver"
Module = require "./module"
{ log, ln, color } = require "lotus-log"
require "lotus-repl"

_printOrigin = -> log.gray.dim "lotus/watch "

log.moat 1
_printOrigin()
log "Gathering modules from "
log.yellow lotus.path
log.moat 1

Module.startup().then ->  
  
  log.moat 1
  _printOrigin()
  log.yellow Object.keys(Module.cache).length
  log " modules were found!"
  log.moat 1

.fail (error) ->
  log.moat 1
  log "Module startup failed!"
  log.moat 1
  { format } = error
  error.format = -> 
    opts = if format instanceof Function then format() else {}
    opts.stack ?= {}
    opts.stack.exclude ?= []
    opts.stack.exclude.push "**/q/q.js"
    opts.stack.filter = (frame) -> frame.isUserCreated()
    opts
  throw error

.done()
