
# TODO: Only initialize modules when necessary (to speed up start-up time and avoid high memory consumption).
# TODO: Automated nightly commits. Exclude generated files.
# TODO: A command that lists the modules that have uncommitted changes.
# TODO: A command that lists the dependencies or dependers of each module.
# TODO: Notify when dependencies exist that aren't being used.

lotus = require "lotus-require"

# TODO: Stop 'lotus-repl' from preventing CTRL+C.
# require "lotus-repl"

{ log, ln, color } = require "lotus-log"
{ sync } = require "io"
semver = require "semver"
Path = require "path"
gaze = require "gaze"
exit = require "exit"

module.exports = (options) ->

  { toJSON, fromJSON } = require "./persistence"

  isCached = sync.isFile "lotus-cache.json"

  startTime = Date.now()

  if isCached

    promise = fromJSON()

  else

    log
      .moat 1
      .white "Crawling: "
      .yellow lotus.path
      .moat 1

    promise = Module.initialize()

  promise.then ->

    log
      .moat 1
      .yellow Object.keys(Module.cache).length
      .white " modules were found"
      .gray " (in #{Date.now() - startTime} ms)"
      .moat 1

    toJSON().done() unless isCached

    isDirty = no

    Module._emitter.on "file event", ->

      isDirty = yes

    exit.on ->

      toJSON().done() if isDirty

  .done()
