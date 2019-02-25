const categoryToQuestion = require('./config.js').categoryToQuestion;

var randomInt = require('random-int');
var microtime = require('microtime');

const GameState = {
    IDLE: 'Idle',
    PLAY: 'Play',
    RESULT: 'Result',
    ADS: 'Ads',
};

const StateDurations = {
    'Idle': 0.5,
    'Play': 21,
    'Result': 4.7,
    'Ads': 60
};

const RoundState = {
    Started: 1,
    Finished: 2
};

class QuizRound {
    constructor(io, desiredQuestions, roundId) {
        this.roundId = roundId;
        this.io = io;
        this.usersPlayed = {};

        var numberOfQuestions = 0;
        for(var i =0; i < desiredQuestions.length; i++) {
            numberOfQuestions += desiredQuestions[i];
        }

        var inverseCDFSample = randomInt(0, numberOfQuestions);

        numberOfQuestions = 0;
        for(var i =0; i < desiredQuestions.length; i++) {
            numberOfQuestions += desiredQuestions[i];
            if(inverseCDFSample <  numberOfQuestions){
                inverseCDFSample = i;
                break;
            }
        }
        if(inverseCDFSample > desiredQuestions.length || inverseCDFSample == 0)
            inverseCDFSample = 8;

        this.numberOfAnswers = 0;
        var randomCategoryId = inverseCDFSample;

        var numberOfQuestionsInCategory = categoryToQuestion[randomCategoryId].length;
        var randomQuestionId = randomInt(0, numberOfQuestionsInCategory-1);
        this.question = categoryToQuestion[randomCategoryId][randomQuestionId];
        if(this.question == null || this.question == undefined){
            this.question = categoryToQuestion[1][2];
        }

        this.timeStarted = microtime.now();
        this.roundState = RoundState.Started;
        var self = this;
        this.clock = setInterval(function() {
            self.update();
        }, 950);

        this.answers = [0, 0, 0, 0];

    }

    isCorrectAnswer(choice) {
        if(this.question.trueAnswer == parseInt(choice)) {
            return true;
        }

        return false;
    }

    addAnswer(user_id, choice) {
        if(this.usersPlayed[user_id] == undefined) {
            this.answers[choice] += 1;
            this.numberOfAnswers += 1;
            this.usersPlayed[user_id] = true;
            return true;
        } else{
            return false;
        }
    }

    getOutput() {

        var question = this.question;

        return {'question': {
                'text': question.text,
                'choices': question.choices,
                'trueAnswer': question.trueAnswer,
                },
            'roundId': this.roundId
            }
    }
    getTimeLeft() {
        var nowInMicroSec = microtime.now();
        return StateDurations[GameState.PLAY] - (nowInMicroSec - this.timeStarted) / 1e6;
    }

    update(){
        var timeLeft = this.getTimeLeft();
        if( timeLeft <= 0) {
            this.roundState = RoundState.Finished;
            console.log('round finished');
            clearInterval(this.clock);
        }

        this.io.in('quiz room').emit('realtime', {'timeLeft': parseInt(timeLeft), 'numberOfAnswers': this.numberOfAnswers});
    }

}

module.exports = class QuizRoom {


    constructor(io) {
        this.io = io;
        this.users = [];

        this.gameState = GameState.IDLE;
        this.rounds = [];
        this.currentRound = undefined;
        this.timeoutClock = undefined;

        var self = this;
        setInterval(function() {
            self.update();
        }, 100);

        this.desiredQuestions = [0, 10, 4, 1, 4, 5, 1, 1, 1];

    }


    update(){

        switch (this.gameState){
            case GameState.IDLE:
                this.currentRound = new QuizRound(this.io, this.desiredQuestions, this.rounds.length);
                this.gameState = undefined;

                var self = this;
                clearTimeout(this.timeoutClock);
                this.timeoutClock = setTimeout(function() {
                    self.gameState = GameState.PLAY;

                    self.io.in('quiz room').emit('play', self.currentRound.getOutput());
                    console.log('GameState changed to PLAY');

                }, StateDurations[GameState.IDLE]*1000);
                break;
            case GameState.PLAY:
                if(this.currentRound != undefined && this.currentRound.roundState != RoundState.Finished) {
                    break;
                }

                this.gameState = GameState.RESULT;

                this.users.sort(function(a, b) {
                   return b.score - a.score;
                });

                var scoreboard = [];
                for(var i = 0; i < this.users.length; i++)
                    scoreboard.push({'phoneId':this.users[i].phoneId, 'name':this.users[i].name, 'score':this.users[i].score, 'rank': i+1});

                if(this.currentRound.numberOfAnswers != 0)
                    for(var i = 0; i < this.currentRound.answers.length; i++){
                        this.currentRound.answers[i] = this.currentRound.answers[i] / this.currentRound.numberOfAnswers;
                    }

                this.io.in('quiz room').emit('results', {
                    'summary': this.currentRound.answers,
                    'scoreboard': scoreboard,
                    'roundId': this.rounds.length
                });

                // Store the old round in rounds array.
                this.rounds.push(this.currentRound);
                clearInterval(this.currentRound.clock);
                this.currentRound = undefined;

                clearTimeout(this.timeoutClock);
                var self = this;
                this.timeoutClock = setTimeout(function() {
                    self.gameState = GameState.IDLE;
                }, StateDurations[GameState.RESULT]*1000);

                break;

            case GameState.ADS:

                break;
        }
    }

    addUser(user) {

        if(user.categoryList != undefined)
            for(var i = 0; i < user.categoryList.length; i++) {
                this.desiredQuestions[user.categoryList[i]] += 1;
            }

        this.users.push(user);

        user.socket.join('quiz room');
        if (this.currentRound != null){
            user.socket.emit('play', this.currentRound.getOutput());
        }
        user.socket.emit('general', {'stateDurations': StateDurations,
            'name': user.name});

        var self = this;
        user.socket.on('move', function(message){

            if(self.gameState != GameState.PLAY || self.currentRound.roundState == RoundState.Finished){
                user.socket.emit('siktir git');
                return false;
            }


            if(self.currentRound.addAnswer(user.phoneId, message.choice)){
                if(self.currentRound.isCorrectAnswer(message.choice)){
                    user.addScore(Math.round(self.currentRound.getTimeLeft(), 2) + 10);
                }
                console.log('User score' + user.score, 'Round answers', self.currentRound.answers);
            }
        });


    }

    removeUser(user){
        if(user == undefined)
            return false;

        if(user.categoryList != undefined)
            for(var i = 0; i < user.categoryList.length; i++) {
                this.desiredQuestions[user.categoryList[i]] -= 1;
            }

        for (var i = 0; i < this.users.length; i++) {
            if(user == this.users[i]) {
                this.users.splice(i, 1);
                return false;
            }
        }
    }
}
