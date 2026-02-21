const mongoose = require('mongoose');

const QUIZ_OPTION_IDS = ['a', 'b', 'c', 'd'];

const quizOptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      enum: QUIZ_OPTION_IDS
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    }
  },
  { _id: false }
);

const correctOptionDetailsSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: ''
    },
    link: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    address: {
      type: String,
      trim: true,
      maxlength: 320,
      default: ''
    }
  },
  { _id: false }
);

const whereIsQuizSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      default: 'default'
    },
    title: {
      type: String,
      trim: true,
      default: 'اینجا کجاست؟'
    },
    subtitle: {
      type: String,
      trim: true,
      default: 'حدس بزن و جایزه ببر'
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ''
    },
    options: {
      type: [quizOptionSchema],
      default: () => [
        { id: 'a', text: 'گزینه اول' },
        { id: 'b', text: 'گزینه دوم' },
        { id: 'c', text: 'گزینه سوم' },
        { id: 'd', text: 'گزینه چهارم' }
      ],
      validate: {
        validator(value) {
          return Array.isArray(value)
            && value.length === 4
            && value.every((item, index) => item && item.id === QUIZ_OPTION_IDS[index] && item.text);
        },
        message: 'Quiz must contain exactly 4 ordered options (a, b, c, d).'
      }
    },
    correctOptionId: {
      type: String,
      required: true,
      enum: QUIZ_OPTION_IDS,
      default: 'a'
    },
    correctOptionDetails: {
      type: correctOptionDetailsSchema,
      default: () => ({
        description: '',
        link: '',
        address: ''
      })
    },
    rewardToman: {
      type: Number,
      default: 5000,
      min: 0
    },
    active: {
      type: Boolean,
      default: false
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhereIsQuiz', whereIsQuizSchema);
