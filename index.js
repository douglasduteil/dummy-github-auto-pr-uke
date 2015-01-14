'use strict';

var path = require('path');
var util = require('util');


var sh = require('shelljs');
var GitHubApi = require("github");

var Promise = require('bluebird');
Error.stackTraceLimit = 25;
Promise.longStackTraces();

var fs = Promise.promisifyAll(require("fs"));
var prompt = Promise.promisifyAll(require('prompt'));





var CONFIG_FILENAME = '.dummy-ghapr.conf.json';
var CONFIG_FILE_LOCATION = process.env.HOME;
var CONFIG_FILE_PATH = path.join(CONFIG_FILE_LOCATION, CONFIG_FILENAME)


var github = new GitHubApi({
    // required
    version: "3.0.0"
    //, debug: true
});

github.authorization.createAsync = Promise.promisify(github.authorization.create);

main();

////

var config = {};

function main(){
  Promise.resolve()
  .then(checkConfigFile)
  .then(githubAuthentify)
  .then(checkGithubAuth)
  .catch(function(e){
    console.error(e.message);
    console.error(e.stack);
  });
}

function githubAuthentify(){

  var PROMPT_INPUTS = {
    properties: {
      username: {
        pattern: /^[a-zA-Z\s\-]+$/,
        message: 'Enter you GitHub username',
        required: true
      },
      password: {
        hidden: true,
        message: 'Enter you GitHub password',
        required: true
      }
    }
  };  

  prompt.start();

  return prompt.getAsync(PROMPT_INPUTS)
    .then(function(result){
      github.authenticate({
        type: "basic",
        username: result.username,
        password: result.password,
      });
    }, function (err){
        process.exit(1);
    });
}

function checkConfigFile(){
  return fs
    .statAsync(CONFIG_FILE_PATH)
    .then(existingConfig, saveConfig);

  ////

  function existingConfig(){
    config = require(CONFIG_FILE_PATH);
    util.debug('Use config  : ' + config);
    return Promise.resolve();
  }
}

function checkGithubAuth(){
  return config.token ? Promise.resolve() :
   createNewAuth()
   .then(function(token){
    config.token = token;
    return saveConfig();
   });
}

function saveConfig(){
  return fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
}

function createNewAuth(){
  
  // curl -i -u <username> -d '{"scopes": ["repo", "user"], "note": "Dummy github auto pr uke token"}' \
  //  https://api.github.com/authorizations

  
  
  return github.authorization.createAsync({
    scopes: ["repo", "user"],
    note: "Dummy github auto pr uke token",
    note_url: "https://github.com/douglasduteil/dummy-github-auto-pr-uke",
  })
  .then(getResponseToken, function(err){
    var TWO_FACTO_REQUIRED_MSG = /Must specify two-factor authentication OTP code./
    return TWO_FACTO_REQUIRED_MSG.test(err.message) ? resolveTwoFactorAuthentication() : Promise.reject(err.message);
  });


  ////
  
  function resolveTwoFactorAuthentication(res){

    var TWO_FACTO_CODE_PROMPT = 'Two-factor authentication OTP code';

    prompt.start();

    // curl -i -u <username> -H "X-GitHub-OTP: <code>" \
    //  -d '{"scopes": ["repo", "user"], "note": "Dummy github auto pr uke token"}' \
    //  https://api.github.com/authorizations
    
    return prompt.getAsync(['Two-factor authentication OTP code'])
      .then(function(code){
        return github.authorization.createAsync({
          scopes: ["repo", "user"],
          note: "Dummy github auto pr uke token",
          note_url: "https://github.com/douglasduteil/dummy-github-auto-pr-uke",
          headers: {
           "X-GitHub-OTP": code[TWO_FACTO_CODE_PROMPT]
          }
        });
      })
      .then(getResponseToken);
    
  }

  function getResponseToken(res){
    return res.token;
  }

}
