const express = require('express');
const bodyParser = require('body-parser');
const app = express();
var cors = require('cors');
var mongoose = require('mongoose');
const morgan = require("morgan");
const User = require("./models/users");
const Log = require("./models/log");

const port = process.env.PORT;

mongoose.connect("", {
    useNewUrlParser: true
});

app.use(morgan("dev"));
app.use(express.json());       // to support JSON-encoded bodies
app.use(cors());

app.get('/api/v1/', function (req, res) {
    res.send({
        status: 200,
        data: "Hello World!"
    });
});

app.patch('/api/v1/update/:productId', function (req, res) {
    const id = req.params.productId;
    const updateOps = {};
    for (const ops of req.body) {
        updateOps[ops.propName] = ops.value;
    }
    User.update({
            _id: id
        }, {
            $set: updateOps
        })
        .exec()
        .then(result => {
            console.log(result);
            res.status(200).json(result);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({
                error: err
            });
        });
});

app.get('/api/v1/getInfo/:userId', function (req, res) {
    const id = req.params.userId;
    User.findById(id)
        .exec()
        .then(doc => {
            console.log("From database", doc);
            if (doc) {
                res.status(200).json(doc);
            } else {
                res.status(404).json({
                    message: "No valid entry found for provided ID"
                });
            }
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({
                error: err
            });
        });
});

app.get('/api/v1/statusUpdate/:userId', function (req, res) {
  Log.find({id: req.params.userId, duration: -1}, function (err, result){
    if (result.length == 0) {
      User.countDocuments({_id: req.params.userId}, function (err, count){ 
        if(count==1){
          const log = new Log({
            _id: new mongoose.Types.ObjectId(),
            id: req.params.userId,
            timeOut: Date.now(),
            timeIn: -1,
            duration: -1
          });

          log
            .save()
            .then(result => {
                console.log(result);
                res.status(201).json({
                    message: "Successfully checked out of class.",
                    createdUser: result
                });
            })
            .catch(err => {
                console.log(err);
                res.status(500).json({
                    error: err
                });
          });
        } else {
          res.status(500).json({
                error: "ID number doesn't exist!"
          });
          return;
        }
      });
    } else { //has an open log object
      User.countDocuments({_id: req.params.userId}, function (err, count){ 
        const time = Date.now();
        const duration = time - result[0].timeOut;
        if(count==1){
          const log = {
            timeIn: time,
            duration: duration
          };

          Log.updateOne({_id: result[0]._id}, log)
          .exec()
          .then(result => {
              console.log(result);
              res.status(201).json({
                    message: "Successfully checked in to class. Time out: " + millisToMinutesAndSeconds(duration),
                    createdUser: result
                });
          })
          .catch(err => {
              console.log(err);
              res.status(500).json({
                  error: err
              });
          });
        } else {
          res.status(500).json({
                error: "ID number doesn't exist!"
          });
          return;
        }
      });
    }
  });
});

app.get('/api/v1/analytics/:userId', function (req, res) {
  User.countDocuments({_id: req.params.userId}, function (err, count){ 
    if(count==1){
      Log.aggregate([
        { $match: {"id": parseInt(req.params.userId)}},
        {
          $group: {
            _id:null, avg: {$avg:"$duration"}
          } 
        }],
      function (err, data) {
        if ( err )
          throw err;
        res.status(201).json({
          data: data
        });
      });
    } else {
      res.status(500).json({
            error: "ID number doesn't exist!"
      });
      return;
    }
  });
});

app.get('/api/v1/analytics/', function (req, res) {
  if (req.query.month !== undefined) {
    if (req.query.month == -1) req.query.month = new Date().getMonth() + 1;
    
    if (req.query.month == 0) {
      Log.aggregate([
        {$project:{"day":{$dayOfMonth:"$timeIn"},
            "month":{$month:"$timeIn"}, "duration": "$duration"}},
        {$sort: { "month": -1 }},
        {
          $group: {
            _id:"$month", avg: {$avg:"$duration"}
          } 
        }],
      function (err, data) {
        if ( err )
          throw err;
        res.status(201).json({
          data: data
        });
      });
    } else {
      Log.aggregate([
        {$project:{"day":{$dayOfMonth:"$timeIn"},
            "month":{$month:"$timeIn"}, "duration": "$duration"}},
        {$match: {"month": parseInt(req.query.month)}},
        {
          $group: {
            _id:null, avg: {$avg:"$duration"}
          } 
        }],
      function (err, data) {
        if ( err )
          throw err;
        res.status(201).json({
          data: data
        });
      });
    }
  } else {
    Log.aggregate([
      {
        $group: {
          _id:null, avg: {$avg:"$duration"}
        } 
      }
      ],
    function (err, data) {
      if ( err )
        throw err;
      res.status(201).json({
        data: data
      });
    });
  }
});

app.get('/api/v1/viewUsers', function (req, res) {
  if (req.query.count != undefined && req.query.count == 1) {
    User.countDocuments({}, function (err, count){ 
     if (err) {
      res.status(500).json({
            error: err
      });
     } else {
      res.status(200).json({count});
     }
    });
  } else {
    User.find()
        .exec()
        .then(docs => {
            console.log(docs);
            //   if (docs.length >= 0) {
            res.status(200).json(docs);
            //   } else {
            //       res.status(404).json({
            //           message: 'No entries found'
            //       });
            //   }
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({
                error: err
            });
        });
  }
});

app.post('/api/v1/users/register', function (req, res) {
    if (!(req.body.name) || !(req.body.id) || !(req.body.grade)) {
      res.status(500).json({
          error: "Please fill in all fields."
      });
      return;
    }

    if (req.body.id.toString().length < 6 || req.body.name.length < 2 || req.body.grade.toString().length > 2) {
      res.status(500).json({
          error: "Make sure your ID number is 6 digits long, and check the grade field."
      });
      return;
    }

    User.countDocuments({_id: req.body.id}, function (err, count){ 
        if(count>0){
            res.status(500).json({
                error: "ID number already exists!"
            });
            return;
        } else {
          const user = new User({
            _id: req.body.id,
            name: req.body.name,
            passIssued: false,
            grade: req.body.grade
          });

          user
              .save()
              .then(result => {
                  console.log(result);
                  res.status(201).json({
                      message: "Successfully created new user.",
                      createdUser: result
                  });
              })
              .catch(err => {
                  console.log(err);
                  res.status(500).json({
                      error: err
                  });
              });
        }
    });
});

app.get('/api/v1/users/delete/:id', function (req, res) {
    req.params.id = parseInt(req.params.id);
    if (!(req.params.id)) {
      res.status(500).json({
          error: "Please fill in all fields."
      });
      return;
    }

    if (req.params.id.toString().length < 6) {
      res.status(500).json({
          error: "Make sure your ID number is 6 digits long, and check the grade field."
      });
      return;
    }

    User.countDocuments({_id: req.params.id}, function (err, count){ 
        if(count>0){
            User.remove({
                    _id: req.params.id
                })
                .exec()
                .then(result => {
                    res.status(200).json(result);
                })
                .catch(err => {
                    console.log(err);
                    res.status(500).json({
                        error: err
                    });
                });
        } else {
          res.status(500).json({
                error: "ID number doesn't exist!"
            });
          return;
        }
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

function millisToMinutesAndSeconds(millis) {
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}