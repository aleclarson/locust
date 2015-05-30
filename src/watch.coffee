
require "lotus-repl"
{ log, ln, color } = require "lotus-log"
Path = require "path"
gaze = require "gaze"
semver = require "semver"
Package = require "./package"

Package.startup().then ->  
  
  log.moat 1
  log.green.bold Object.keys(Package.cache).length
  log " packages were found!"
  log.moat 1

.fail (error) ->
  log.moat 1
  log "Package startup failed!"
  log.moat 1
  { format } = error
  error.format = -> 
    opts = if format instanceof Function then format() else {}
    opts.stack ?= {}
    opts.stack.exclude ?= []
    opts.stack.exclude.push "**/q/q.js"
    opts.stack.filter = (frame) -> !frame.isNode() and !frame.isNative() and !frame.isEval()
    opts
  throw error

.done()
