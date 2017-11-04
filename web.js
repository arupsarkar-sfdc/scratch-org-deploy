// https://hosted-scratch-qa.herokuapp.com/launch?template=https://github.com/mshanemc/DF17integrationWorkshops

const ua = require('universal-analytics');
const express = require('express');
const expressWs = require('express-ws');
const bodyParser = require('body-parser');
const logger = require('heroku-logger');
// const cookieParser = require('cookie-parser');

// const http = require('http');

const mq = require('amqplib').connect(process.env.CLOUDAMQP_URL || 'amqp://localhost');

const app = express();
const wsInstance = expressWs(app);

// const router = express.Router();

app.use('/scripts', express.static(`${__dirname}/scripts`));
app.use('/dist', express.static(`${__dirname}/dist`));

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(bodyParser.json());
app.set('view engine', 'ejs');
// app.use(cookieParser());
app.get('/launch', (req, res) => {
  // what are we deploying?
  const repo = req.query.template.replace('https://github.com/', '').replace('/', '-');
  // generate unique id for this deployment
  const deployId = encodeURIComponent(`${repo}-${new Date().valueOf()}`);
  logger.debug(`creating new deployId of ${deployId}`);

  // drop a message
  const message = {
    deployId,
    template : req.query.template
  };
  // analytics
  const visitor = ua(process.env.UA_ID);
  visitor.pageview('/launch').send();
  visitor.event('Repo', req.query.template).send();


  mq.then( (mqConn) => {
    let ok = mqConn.createChannel();
    ok = ok.then((ch) => {
      ch.assertQueue('deploys', { durable: true });
      ch.sendToQueue('deploys', new Buffer(JSON.stringify(message)));
    });
    return ok;
  }).then( () => {
    // return the deployId page
    return res.redirect(`/deploying/${deployId}`);
  }, (mqerr) => {
    logger.error(mqerr);
    return res.redirect('/error', {
      customError : mqerr
    });
  });
});

app.get('/deploying/:deployId', (req, res) => {
  // show the page with .io to subscribe to a topic
  res.render('pages/messages', { deployId: req.params.deployId });
});

app.ws('/deploying/:deployId', (ws, req) => {
    logger.debug('client connected!');
    // ws.send('welcome to the socket!');
    ws.on('close', () => logger.info('Client disconnected'));
  }
);

const port = process.env.PORT || 8443;


app.listen(port, () => {
  logger.info(`Example app listening on port ${port}!`);
});


mq.then( (mqConn) => {
	let ok = mqConn.createChannel();
	ok = ok.then((ch) => {
		ch.assertQueue('deployMessages', { durable: true });
		ch.consume('deployMessages', (msg) => {
      // do a whole bunch of stuff here!
      logger.debug('heard a message from the worker');
      const parsedMsg = JSON.parse(msg.content.toString());
      logger.debug(parsedMsg);
      wsInstance.getWss().clients.forEach((client) => {
        if (client.upgradeReq.url.includes(parsedMsg.deployId)){
          client.send(msg.content.toString());
          // close connection when ALLDONE
          if (parsedMsg.content === 'ALLDONE'){
            client.close();
          }
        }
      });

			ch.ack(msg);
		}, { noAck: false });
	});
	return ok;

});

