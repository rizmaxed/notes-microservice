import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import dayjs from 'dayjs';
import * as util from '../lib/utils.mjs';

import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';

import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';

const logger = new Logger({ serviceName: 'NotesApi' });
const metrics = new Metrics({ namespace: 'NotesApp', serviceName: 'NotesApi' });
const tracer = new Tracer({ serviceName: 'NotesApi' });

const client = tracer.captureAWSv3Client(new DynamoDBClient());
const dynamodb = DynamoDBDocumentClient.from(client);

const tableName = process.env.NOTES_TABLE;

const baseHandler = async (event) => {
    const item = JSON.parse(event.body).Item;

    item.user_id = util.getUserId(event.headers);
    item.user_name = util.getUserName(event.headers);
    item.expires = dayjs().add(90, 'day').unix();

    logger.info('Updating note', {
        user_id: item.user_id,
        note_id: item.note_id,
        title: item.title,
        ts: item.ts
    });

    // X-Ray tracing annotations and metadata
    tracer.putAnnotation('operation', 'updateNote');
    tracer.putAnnotation('user_id', item.user_id);
    tracer.putMetadata('noteBeforeUpdate', item);

    const command = new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: '#t = :t',
        ExpressionAttributeNames: {
            '#t': 'ts'
        },
        ExpressionAttributeValues: {
            ':t': item.ts
        }
    });

    await dynamodb.send(command);

    metrics.addDimension('user_id', item.user_id);
    metrics.addMetric('NoteUpdated', MetricUnit.Count, 1);

    tracer.putMetadata('noteAfterUpdate', item);

    return {
        statusCode: 200,
        headers: util.getResponseHeaders(),
        body: JSON.stringify(item)
    };
};

export const lambdaHandler = middy(baseHandler)
    .use(httpErrorHandler())
    .use(logMetrics(metrics))
    .use(captureLambdaHandler(tracer))
    .before((request) => {
        logger.addContext(request.context);
    });