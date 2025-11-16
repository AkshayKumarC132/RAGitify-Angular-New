import { defineConfig } from 'karma';

export default defineConfig({
  basePath: '',
  frameworks: ['jasmine', '@angular-devkit/build-angular'],
  plugins: [
    require('karma-jasmine'),
    require('karma-chrome-launcher'),
    require('karma-jasmine-html-reporter'),
    require('karma-coverage'),
    require('@angular-devkit/build-angular/plugins/karma')
  ],
  client: {
    jasmine: {
      random: false
    },
    clearContext: false
  },
  jasmineHtmlReporter: {
    suppressAll: true
  },
  coverageReporter: {
    dir: require('path').join(__dirname, './coverage/ragitify-frontend'),
    subdir: '.',
    reporters: [{ type: 'html' }, { type: 'text-summary' }]
  },
  reporters: ['progress', 'kjhtml'],
  browsers: ['Chrome'],
  restartOnFileChange: true
});
