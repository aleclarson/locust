
# TODO: Automated nightly commits. Exclude generated files.
# TODO: A command that lists the modules that have uncommitted changes.
# TODO: A command that lists the dependencies of each module.
# TODO: A command that lists the dependers of each module.

lotus = require "../../../lotus-require"

require "lotus-repl"
{ log, ln, color } = require "lotus-log"

log._repl = (scope) ->
  log.repl.sync scope

semver = require "semver"
Path = require "path"
gaze = require "gaze"

Module = require "./module"

module.exports = ->
  
  Module = Module.initialize()

  log.moat 1
  _printOrigin()
  log "Gathering modules from "
  log.yellow lotus.path
  log.moat 1

  Module.initialize().then ->  
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

_printOrigin = ->
  log.gray.dim "lotus/watch "
