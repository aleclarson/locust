
{ async } = require "io"
lotus = require "lotus-require"
log = require "lotus-log"

Module = (require "./module").initialize()
File = (require "./file").initialize()

module.exports =

  toJSON: () ->

    startTime = Date.now()

    modules = []

    files = []

    async.each Module.cache, (module) ->

      async.try ->

        module.toJSON()

      .then (json) ->

        return if json is no

        modules.push json

        async.each module.files, (file, path) ->

          async.try ->

            file.toJSON()

          .then (json) ->

            files.push json

    .then ->

      async.write "lotus-cache.json", JSON.stringify { modules, files }

    .then ->

      log.origin "lotus/persistence"
      log.green "exported "
      log.yellow lotus.path + "/lotus-cache.json"
      log.gray " (in #{Date.now() - startTime} ms)"
      log.moat 1

  fromJSON: ->

    startTime = Date.now()

    async.read "lotus-cache.json"

    .then (json) ->

      json = JSON.parse json

      async.each json.modules, (module) ->

        async.try ->

          Module.fromJSON module

        .then (module) ->

          async.each module.files, (file) ->

            File.fromJSON file, json.files

        .fail async.catch

    .then ->

      log.origin "lotus/persistence"
      log.green "imported "
      log.yellow lotus.path + "/lotus-cache.json"
      log.gray " (in #{Date.now() - startTime} ms)"
      log.moat 1
