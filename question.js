
module.exports = class Question {
    constructor(row) {
        this.text = row['question'];
        this.choices = [row['option_a'], row['option_b'], row['option_c'], row['option_d']];
        this.trueAnswer = parseInt(row['answer']);
    }

}