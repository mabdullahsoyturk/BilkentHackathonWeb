
module.exports =  class User{

    constructor(socket, phoneId, name, categoryList){
        this.socket = socket;
        this.phoneId = phoneId;
        this.name = name;
        this.categoryList = categoryList;
        this.score = 0;
    }

    addScore(score) {
        this.score += score;
    }

}