
# TODO: Only initialize modules when necessary (to speed up start-up time and avoid high memory consumption).
# TODO: Automated nightly commits. Exclude generated files.
# TODO: A command that lists the modules that have uncommitted changes.
# TODO: A command that lists the dependencies or dependers of each module.
# TODO: Notify when dependencies exist that aren't being used.

Lotus = require "./index"

# TODO: Stop 'lotus-repl' from preventing CTRL+C.
# require "lotus-repl"

{ log, ln, color } = require "lotus-log"
{ sync, async } = require "io"

semver = require "semver"
Path = require "path"
exit = require "exit"

module.exports = (options) ->

  { toJSON, fromJSON } = require "./persistence"

  isDirty = no
  Lotus.Module._emitter.on "file event", -> isDirty = yes
  exit.on -> toJSON().done() if isDirty

  isCached = sync.isFile "lotus-cache.json"

  promise = if isCached then fromJSON() else async.resolve()

  promise.then ->

    log
      .moat 1
      .white "Crawling: "
      .yellow Lotus.path
      .moat 1

    Lotus.Module.crawl Lotus.path

  .then (newModules) ->

    if newModules.length > 0

      log
        .moat 1
        .white "Found #{newModules.length} modules: "
        .moat 1
      log.plusIndent 2
      for module in newModules
        log.green module.name
        log.moat 1
      log.popIndent()

      toJSON().done()

    log
      .moat 1
      .cyan "Listening for file changes..."
      .moat 1

  .done()
