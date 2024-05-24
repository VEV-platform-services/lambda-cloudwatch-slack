const AWS = require("aws-sdk");
const url = require("url");
const https = require("https");
const config = require("./config");
const _ = require("lodash");
let hookUrl;

const baseSlackMessage = {};

const postMessage = (message, callback) => {
  const body = JSON.stringify(message);
  const options = url.parse(hookUrl);
  options.method = "POST";
  options.headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  };
  console.log("Posting cloudwatch message", { body, options });
  const postReq = https.request(options, (res) => {
    const chunks = [];
    res.setEncoding("utf8");
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      const body = chunks.join("");
      if (callback) {
        callback({
          body: body,
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
        });
      }
    });
    return res;
  });

  postReq.write(body);
  postReq.end();
};

const isoDateToSlackFormat = (isoDate) => {
  const date = new Date(isoDate);
  const timestampMillis = date.getTime();
  return (timestampMillis / 1000).toFixed(6);
};

const handleCodePipeline = (event, context) => {
  const subject = "AWS CodePipeline Notification";
  const timestamp = new Date(event.Records[0].Sns.Timestamp).getTime() / 1000;
  let message;
  const fields = [];
  let color = "warning";
  let changeType = "";

  try {
    message = JSON.parse(event.Records[0].Sns.Message);
    const detailType = message["detail-type"];

    if (detailType === "CodePipeline Pipeline Execution State Change") {
      changeType = "";
    } else if (detailType === "CodePipeline Stage Execution State Change") {
      changeType = "STAGE " + message.detail.stage;
    } else if (detailType === "CodePipeline Action Execution State Change") {
      changeType = "ACTION";
    }

    if (message.detail.state === "SUCCEEDED") {
      color = "good";
    } else if (message.detail.state === "FAILED") {
      color = "danger";
    }
    const header = message.detail.state + ": CodePipeline " + changeType;
    fields.push({ title: "Message", value: header, short: false });
    fields.push({
      title: "Pipeline",
      value: message.detail.pipeline,
      short: true,
    });
    fields.push({ title: "Region", value: message.region, short: true });
    fields.push({
      title: "Status Link",
      value:
        "https://console.aws.amazon.com/codepipeline/home?region=" +
        message.region +
        "#/view/" +
        message.detail.pipeline,
      short: false,
    });
  } catch (e) {
    color = "good";
    message = event.Records[0].Sns.Message;
    const header =
      message.detail.state + ": CodePipeline " + message.detail.pipeline;
    fields.push({ title: "Message", value: header, short: false });
    fields.push({ title: "Detail", value: message, short: false });
  }

  const slackMessage = {
    text: "*" + subject + "*",
    attachments: [
      {
        color: color,
        fields: fields,
        ts: timestamp,
      },
    ],
  };

  return _.merge(slackMessage, baseSlackMessage);
};

const handleElasticache = (event, context) => {
  const subject = "AWS ElastiCache Notification";
  const message = JSON.parse(event.Records[0].Sns.Message);
  const timestamp = new Date(event.Records[0].Sns.Timestamp).getTime() / 1000;
  const region = event.Records[0].EventSubscriptionArn.split(":")[3];
  let eventname, nodename;
  const color = "good";

  for (const key in message) {
    eventname = key;
    nodename = message[key];
    break;
  }
  const slackMessage = {
    text: "*" + subject + "*",
    attachments: [
      {
        color: color,
        fields: [
          { title: "Event", value: eventname.split(":")[1], short: true },
          { title: "Node", value: nodename, short: true },
          {
            title: "Link to cache node",
            value:
              "https://console.aws.amazon.com/elasticache/home?region=" +
              region +
              "#cache-nodes:id=" +
              nodename +
              ";nodes",
            short: false,
          },
        ],
        ts: timestamp,
      },
    ],
  };
  return _.merge(slackMessage, baseSlackMessage);
};

const handleSESBounce = (event, context) => {
  const subject = "AWS SES Bounce Notification";
  const color = "danger";
  const message = JSON.parse(event.Records[0].Sns.Message);

  const slackMessage = {
    text: "*" + subject + "*",
    attachments: [
      {
        color: color,
        fields: [
          {
            title: "Bounce recipients",
            value: message.bounce.bouncedRecipients
              ?.map((recipient) => recipient.emailAddress)
              .join(", "),
            short: false,
          },
          { title: "Source", value: message.mail.source, short: true },
          {
            title: "Bounce Type",
            value: message.bounce.bounceType,
            short: true,
          },
          {
            title: "Bounce Sub Type",
            value: message.bounce.bounceSubType,
            short: true,
          },
          {
            title: "Bounce Timestamp",
            value: message.bounce.timestamp,
            short: true,
          },
          {
            title: "Subject",
            value: message.mail.commonHeaders.subject,
            short: true,
          },
          {
            title: "Sent Timestamp",
            value: message.mail.timestamp,
            short: true,
          },
        ],
        ts: isoDateToSlackFormat(message.bounce.timestamp),
      },
    ],
  };
  return _.merge(slackMessage, baseSlackMessage);
};

const handleSESComplaint = (event, context) => {
  const subject = "AWS SES Complaint Notification";
  const color = "danger";
  const message = JSON.parse(event.Records[0].Sns.Message);

  const slackMessage = {
    text: "*" + subject + "*",
    attachments: [
      {
        color: color,
        fields: [
          {
            title: "Complaint recipients",
            value: message.complaint.complainedRecipients
              ?.map((recipient) => recipient.emailAddress)
              .join(", "),
            short: false,
          },
          { title: "Source", value: message.mail.source, short: true },
          {
            title: "complaintFeedbackType",
            value: message.complaint.complaintFeedbackType,
            short: true,
          },
          {
            title: "complaintSubType",
            value: message.complaint.complaintSubType,
            short: true,
          },
          {
            title: "Complaint Timestamp",
            value: message.complaint.timestamp,
            short: true,
          },
          {
            title: "Subject",
            value: message.mail.commonHeaders.subject,
            short: true,
          },
          {
            title: "Sent Timestamp",
            value: message.mail.timestamp,
            short: true,
          },
        ],
        ts: isoDateToSlackFormat(message.complaint.timestamp),
      },
    ],
  };
  return _.merge(slackMessage, baseSlackMessage);
};

const getFirstMetricLabel = (data) => {
  const metrics = data.Trigger.Metrics;
  if (metrics.length > 0) {
    return metrics[0].Label;
  } else {
    return "No metrics available"; // or handle this case as needed
  }
};

const handleCloudWatch = (event, context) => {
  const timestamp = new Date(event.Records[0].Sns.Timestamp).getTime() / 1000;
  const message = JSON.parse(event.Records[0].Sns.Message);
  const region = event.Records[0].EventSubscriptionArn.split(":")[3];
  const subject = "AWS CloudWatch Notification";
  const alarmName = message.AlarmName;
  const metricName = message.Trigger.MetricName;
  const label = getFirstMetricLabel(message);
  const oldState = message.OldStateValue;
  const newState = message.NewStateValue;
  const alarmDescription = message.AlarmDescription;
  const trigger = message.Trigger;
  let color = "warning";

  if (message.NewStateValue === "ALARM") {
    color = "danger";
  } else if (message.NewStateValue === "OK") {
    color = "good";
  }

  const slackMessage = {
    text: "*" + subject + "*",
    attachments: [
      {
        color: color,
        fields: [
          { title: "Alarm Name", value: alarmName, short: true },
          { title: "Alarm Description", value: alarmDescription, short: false },
          {
            title: "Trigger",
            value:
              (trigger.Statistic && metricName
                ? trigger.Statistic + " " + metricName
                : label) +
              " " +
              trigger.ComparisonOperator +
              " " +
              trigger.Threshold +
              " for " +
              trigger.EvaluationPeriods +
              " period(s) of " +
              trigger.Period +
              " seconds.",
            short: false,
          },
          { title: "Old State", value: oldState, short: true },
          { title: "Current State", value: newState, short: true },
          {
            title: "Link to Alarm",
            value:
              "https://console.aws.amazon.com/cloudwatch/home?region=" +
              region +
              "#alarm:alarmFilter=ANY;name=" +
              encodeURIComponent(alarmName),
            short: false,
          },
        ],
        ts: timestamp,
      },
    ],
  };
  return _.merge(slackMessage, baseSlackMessage);
};

const handleAutoScaling = (event, context) => {
  const subject = "AWS AutoScaling Notification";
  const message = JSON.parse(event.Records[0].Sns.Message);
  const timestamp = new Date(event.Records[0].Sns.Timestamp).getTime() / 1000;
  const color = "good";

  const slackMessage = {
    text: "*" + subject + "*",
    attachments: [
      {
        color: color,
        fields: [
          {
            title: "Message",
            value: event.Records[0].Sns.Subject,
            short: false,
          },
          { title: "Description", value: message.Description, short: false },
          { title: "Event", value: message.Event, short: false },
          { title: "Cause", value: message.Cause, short: false },
        ],
        ts: timestamp,
      },
    ],
  };
  return _.merge(slackMessage, baseSlackMessage);
};

const handleCatchAll = (event, context) => {
  const record = event.Records[0];
  const subject = record.Sns.Subject;
  const timestamp = new Date(record.Sns.Timestamp).getTime() / 1000;
  const message = JSON.parse(record.Sns.Message);
  let color = "warning";

  if (message.NewStateValue === "ALARM") {
    color = "danger";
  } else if (message.NewStateValue === "OK") {
    color = "good";
  }

  // Add all of the values from the event message to the Slack message description
  let description = "";
  for (const key in message) {
    const renderedMessage =
      typeof message[key] === "object"
        ? JSON.stringify(message[key])
        : message[key];

    description = description + "\n" + key + ": " + renderedMessage;
  }

  const slackMessage = {
    text: "*" + subject + "*",
    attachments: [
      {
        color: color,
        fields: [
          { title: "Message", value: record.Sns.Subject, short: false },
          { title: "Description", value: description, short: false },
        ],
        ts: timestamp,
      },
    ],
  };

  return _.merge(slackMessage, baseSlackMessage);
};

const processEvent = (event, context) => {
  console.log("sns received:" + JSON.stringify(event, null, 2));
  let slackMessage = null;
  const eventSubscriptionArn = event.Records[0].EventSubscriptionArn;
  const eventSnsSubject = event.Records[0].Sns.Subject || "no subject";
  const eventSnsMessageRaw = event.Records[0].Sns.Message;
  let eventSnsMessage = null;

  try {
    eventSnsMessage = JSON.parse(eventSnsMessageRaw);
  } catch (e) {}

  if (
    eventSubscriptionArn.indexOf(config.services.codepipeline.match_text) >
      -1 ||
    eventSnsSubject.indexOf(config.services.codepipeline.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.codepipeline.match_text) > -1
  ) {
    console.log("processing codepipeline notification");
    slackMessage = handleCodePipeline(event, context);
  } else if (
    eventSubscriptionArn.indexOf(config.services.elasticbeanstalk.match_text) >
      -1 ||
    eventSnsSubject.indexOf(config.services.elasticbeanstalk.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.elasticbeanstalk.match_text) > -1
  ) {
    console.log("processing elasticbeanstalk notification");
    slackMessage = handleElasticBeanstalk(event, context);
  } else if (
    eventSnsMessage &&
    "notificationType" in eventSnsMessage &&
    eventSnsMessage.notificationType === "Bounce"
  ) {
    console.log("processing SES bounce notification");
    slackMessage = handleSESBounce(event, context);
  } else if (
    eventSnsMessage &&
    "notificationType" in eventSnsMessage &&
    eventSnsMessage.notificationType === "Complaint"
  ) {
    console.log("processing SES complaint notification");
    slackMessage = handleSESComplaint(event, context);
  } else if (
    eventSnsMessage &&
    "AlarmName" in eventSnsMessage &&
    "AlarmDescription" in eventSnsMessage
  ) {
    console.log("processing cloudwatch notification");
    slackMessage = handleCloudWatch(event, context);
  } else if (
    eventSubscriptionArn.indexOf(config.services.codedeploy.match_text) > -1 ||
    eventSnsSubject.indexOf(config.services.codedeploy.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.codedeploy.match_text) > -1
  ) {
    console.log("processing codedeploy notification");
    slackMessage = handleCodeDeploy(event, context);
  } else if (
    eventSubscriptionArn.indexOf(config.services.elasticache.match_text) > -1 ||
    eventSnsSubject.indexOf(config.services.elasticache.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.elasticache.match_text) > -1
  ) {
    console.log("processing elasticache notification");
    slackMessage = handleElasticache(event, context);
  } else if (
    eventSubscriptionArn.indexOf(config.services.autoscaling.match_text) > -1 ||
    eventSnsSubject.indexOf(config.services.autoscaling.match_text) > -1 ||
    eventSnsMessageRaw.indexOf(config.services.autoscaling.match_text) > -1
  ) {
    console.log("processing autoscaling notification");
    slackMessage = handleAutoScaling(event, context);
  } else {
    slackMessage = handleCatchAll(event, context);
  }

  postMessage(slackMessage, (response) => {
    if (response.statusCode < 400) {
      console.info("message posted successfully");
      context.succeed();
    } else if (response.statusCode < 500) {
      console.error(
        "error posting message to slack API: " +
          response.statusCode +
          " - " +
          response.statusMessage
      );
      // Don't retry because the error is due to a problem with the request
      context.succeed();
    } else {
      // Let Lambda retry
      context.fail(
        "server error when processing message: " +
          response.statusCode +
          " - " +
          response.statusMessage
      );
    }
  });
};

exports.handler = (event, context) => {
  if (hookUrl) {
    processEvent(event, context);
  } else if (config.unencryptedHookUrl) {
    hookUrl = config.unencryptedHookUrl;
    processEvent(event, context);
  } else if (
    config.kmsEncryptedHookUrl &&
    config.kmsEncryptedHookUrl !== "<kmsEncryptedHookUrl>"
  ) {
    const encryptedBuf = new Buffer(config.kmsEncryptedHookUrl, "base64");
    const cipherText = { CiphertextBlob: encryptedBuf };
    const kms = new AWS.KMS();

    kms.decrypt(cipherText, (err, data) => {
      if (err) {
        console.log("decrypt error: " + err.toString());
        processEvent(event, context);
      } else {
        hookUrl = "https://" + data.Plaintext.toString("ascii");
        processEvent(event, context);
      }
    });
  } else {
    context.fail("hook url has not been set.");
  }
};
