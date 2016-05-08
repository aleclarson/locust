var command, minimist, options;

require("./global");

minimist = require("minimist");

process.options = options = minimist(process.argv.slice(2));

command = options._.shift();

lotus.initialize().then(function() {
  return lotus.runCommand(command, options);
}).done();

//# sourceMappingURL=../../map/src/cli.map
