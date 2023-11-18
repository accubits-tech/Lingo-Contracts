module.exports = {
  exit: true,
  recursive: true,
  timeout: 60000,
  bail: true,
  reporter: 'mochawesome',
  'reporter-options': ["reportFilename= 'Lingo-Token-Test-Report'", 'quiet= true'],
};
