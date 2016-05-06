
# TODO: Only initialize modules when necessary (to speed up start-up time and avoid high memory consumption).
# TODO: Automated nightly commits. Exclude generated files.
# TODO: A command that lists the modules that have uncommitted changes.
# TODO: A command that lists the dependencies or dependers of each module.
# TODO: Notify when dependencies exist that aren't being used.

inArray = require "in-array"
syncFs = require "io/sync"
semver = require "semver"
Path = require "path"

Cache = require "./Cache"

ignoredErrors = [
  "Cache does not exist!"
  "Cache was manually reset!"
]

cache = Cache lotus.path + "/lotus-cache.json"

cache.load process.options

.fail (error) ->
  return if inArray ignoredErrors, error.message
  throw error

.then ->

  log.moat 1
  log.white "Crawling: "
  log.yellow lotus.path
  log.moat 1

  lotus.Module.crawl lotus.path

.then (newModules) ->

  log.moat 1
  if newModules.length > 0
    cache.isDirty = yes
    log.white "Found #{log.color.green newModules.length} new modules: "
    log.moat 1
    log.plusIndent 2
    for module, index in newModules
      color = if index % 2 then "cyan" else "green"
      newPart = module.name + " "
      newLength = log.line.length + newPart.length
      log.moat 0 if newLength > log.size[0] - log.indent
      log[color] newPart
    log.popIndent()
  else
    log.white "Found #{log.color.green.dim 0} new modules!"

  cache.save()

  .then ->
    log.moat 1
    log.gray "Watching files..."
    log.moat 1

.done()
