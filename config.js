/* PARSING DATA */

var fs = require('fs');
var Question = require('./question');

var questions = JSON.parse(fs.readFileSync('./data/questions.json', 'utf8'));

var categoryToQuestion = {};

var categories = JSON.parse(fs.readFileSync('./data/categories.json', 'utf8'));

for(var i = 0; i < categories.length; i++) {
    if(parseInt(categories[i]._id) >= 10)
        continue;

    categoryToQuestion[categories[i]._id] = [];
}

for(var i = 0; i < questions.length; i++) {
    if(parseInt(questions[i].category_id) >= 10)
        continue;
    categoryToQuestion[parseInt(questions[i].category_id)].push(new Question(questions[i])) ;
}

/* PARSING DATA ENDS */

module.exports = {
    'categoryToQuestion': categoryToQuestion
};
