const express = require('express'),
    app = express(),
    engines = require('consolidate'),
    mdbClient = require('mongodb').MongoClient,
    bodyParser = require('body-parser'),
    nodemailer = require('nodemailer'),
    nunjucks = require('nunjucks'),
    assert = require('assert');

const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const success = '✔️️',
    failure = '❗';

const url = 'mongodb://localhost:27017/students';

//lolWATpass000
//mongoimport --db students --collection roster --drop --file ~/workspace/student-data.json --jsonArray

app.engine('html', engines.nunjucks);
app.set('view engine','html');
app.set('views', __dirname + "/views");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

function errorHandler(err, req, res, next){
    console.error(err.message);
    console.error(err.stack);
    res.status(500).render('error_template', {error: err});
}

function sendMail(student, mailType, recommend){
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.NMAILER_USER,
            pass: process.env.NMAILER_PASS
        }
    });
    
    let mailOptions = {
        from: '"School Alerts" <school.alerts.cs09@gmail.com>',
        to: student['parent-email'],
    }
    
    if (mailType === 'alert-fail'){
        if (student.grade < 65) {
            mailOptions.subject = `Concern Regarding ${student.fname} ${student.lname}'s Academic Performance`;
            mailOptions.html = `This is an automated email regarding ${student.fname} ${student.lname}'s grades.
                ${student.fname} currently has a grade of ${student.grade}.`;
        } else {
            return false;
        }
    } else if (mailType === 'alert-absent'){
        if (student.absents > 5){
            mailOptions.subject = `Concern Regarding ${student.fname} ${student.lname}'s Attendance`;
            mailOptions.html = `This is an automated email regarding ${student.fname} ${student.lname}'s attendance.
                ${student.lname} currently has missed class <b>${student.absents}</b> times.`;
        } else {
            return false;
        }
    } else if (mailType === 'remind-assessment'){
        mailOptions.subject = `Reminder for ${student.fname} ${student.lname}'s Major Assessment`;
        mailOptions.html = `This is an automated email to remind you that your child, 
            ${student.fname} ${student.lname}, has a major assessment/deadline approaching.<br><br>
            Please log into the school's <a href="">LMS</a> or <a href="">Google Classroom</a> for more
            information.`;
    } else if (mailType === 'remind-ptc'){
        mailOptions.subject = `Reminder for ${student.fname} ${student.lname}'s upcoming Parent-Teacher Conference`;
        mailOptions.html = `This is an automated email to remind you that 
        ${student.fname} ${student.lname} has an upcoming parent-teacher conference.<br><br>
            Please visit the <a href="">school announcements site</a> for more information.`;
    }
    
    if (recommend && (mailType === 'alert-absent' || mailType === 'alert-fail')){
        mailOptions.html+=`<br><br><h2>Action Items:</h2>
            <a href="https://google.com">Log into the school LMS</a><br>
            <a href="https://classroom.google.com">Log into Google Classroom</a><br>
            <a href="https://google.com">Contact guidance counselor</a><br>
            <a href="https://google.com">Email the teacher with questions or comments</a><br>`;
    }
    
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) console.log(err);
        console.log(`Message ${info.messageID} sent: ${info.response}`);
    })
    
    console.log(`sent mail for student ${student.fname} ${student.lname} with notification ${mailType}`);
    return true;
}

function sendText(student, textType){
    let message;
    if(textType === 'alert-fail'){
        if (student.grade < 65)
            message = `Alert: Your child ${student.fname} is failing his/her class with a ${student.grade}. See email for more details.`;
        else
            return false;
    } else if (textType === 'alert-absent') {
        if (student.absents > 5)
            message = `Alert: Your child ${student.fname} is has excessive (${student.absents}) absences. See email for more details.`;
        else
            return false;
    } else if (textType === 'remind-assessment') {
        message = `Reminder: Your child ${student.fname} has an upcoming assessment/deadline. See Classroom for details.`;
    } else if (textType === 'remind-ptc'){
        message = `Reminder: Your child ${student.fname} has an upcoming parent-teacher conference. See school news for details.`;
    }
    
    client.messages.create({
            from: "9782917555",
            to: student['parent-phone'],
            body: message
        }, (err,msg) => {
            if (err) console.error(err.message);
            return false;
    });
    return true;
}

app.get('/', (req, res, next) => {
    res.render('index', {});
});

// const re = new RegExp('/[ABCDE]|/period');

app.get(new RegExp('/[ABCDE]|/period'), (req, res, next) => {
    const per = req.originalUrl.replace("/","");
    mdbClient.connect(url, (err, db) => {
        assert.equal(null, err);
        console.log("successfully connected to db");
        
        db.collection('roster').find({"class":per}).toArray((err, docs) => {
            assert.equal(null, err)
            docs.sort((a,b) => a.lname.localeCompare(b.lname))
            res.render('index', {students: docs, period: per});
            db.close();
        });
        
        console.log('Retrieved docs');
    });
});
// { period: 'A',
//   'alert-fail': 'on',
//   'alert-absent': 'on',
//   'remind-assessment': 'on',
//   'remind-ptc': 'on',
//   recommend: 'on' }
app.post('/send', (req,res,next) => {
    const per = req.body.period;
    const types = ['alert-fail','alert-absent','remind-assessment','remind-ptc'];
    const notifications = {
        'alert-fail': req.body['alert-fail'] ? true : false,
        'alert-absent': req.body['alert-absent'] ? true : false,
        'remind-assessment': req.body['remind-assessment'] ? true : false,
        'remind-ptc': req.body['remind-ptc'] ? true : false
    };
    
    console.log(notifications);
    
    // res.redirect(`/${req.body.period}`);
    mdbClient.connect(url, (err, db) => {
        assert.equal(null, err);
        console.log("successfully connected to db");
        
        db.collection('roster').find({"class":per}).toArray((err, docs) => {
            docs.sort((a,b) => a.lname.localeCompare(b.lname))
            for(let i=0;i<docs.length;i++){
                if(req.body['send-text'] && docs[i]['parent-phone'] !== ""){
                    for(let j=0; j<types.length; j++)
                        if (notifications[types[j]])
                            docs[i].text_success = sendText(docs[i], types[j]) || docs[i].text_success ? success : "";
                }
                if(req.body['send-email'] && docs[i]['parent-email'] !== "")
                    for(let j=0; j<types.length; j++){
                        if (notifications[types[j]])
                            docs[i].email_success = sendMail(docs[i], types[j], req.body.recommend) || docs[i].email_success ? success : "";
                    }
            }
            res.render('index', {students: docs, period: per});
            db.close();
        });
        
        console.log('Retrieved docs');
    });
});

app.use(errorHandler);

const server = app.listen(8080, () => {
    const port = server.address().port;
    console.log(`express server listening on port ${port}`);
})