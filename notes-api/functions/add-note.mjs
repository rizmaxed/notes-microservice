import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import * as util from '../lib/utils.mjs';

import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';

import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';

const logger = new Logger({ serviceName: 'NotesApi' });
const metrics = new Metrics({ namespace: 'NotesApp', serviceName: 'NotesApi' });
const tracer = new Tracer({ serviceName: 'NotesApi' });

const client = tracer.captureAWSv3Client(new DynamoDBClient());
const dynamodb = DynamoDBDocumentClient.from(client);

const tableName = process.env.NOTES_TABLE;

const baseHandler = async (event) => {
    const item = event.body.Item;

    item.user_id = util.getUserId(event.headers);
    item.user_name = util.getUserName(event.headers);
    item.note_id = `${item.user_id}:${uuidv4()}`;

    const now = dayjs();
    item.ts = now.unix();
    item.expires = now.add(90, 'day').unix();

    logger.info('Creating note', {
        user_id: item.user_id,
        title: item.title,
        ts: item.ts,
    });

    await dynamodb.send(
        new PutCommand({
            TableName: tableName,
            Item: item,
        })
    );

    // Powertools Metrics
    metrics.addDimension('user_id', item.user_id);
    metrics.addMetric('NoteCreated', MetricUnit.Count, 1);

    // Powertools Tracer annotations and metadata for X-Ray
    tracer.putAnnotation('user_id', item.user_id);
    tracer.putAnnotation('note_id', item.note_id);
    tracer.putAnnotation('operation', 'addNote');
    tracer.putMetadata('noteDetails', {
        title: item.title,
        ts: item.ts,
        expires: item.expires
    });

    return {
        statusCode: 200,
        headers: util.getResponseHeaders(),
        body: JSON.stringify(item),
    };
};

// Proper usage of Powertools Tracer and Metrics middleware with Middy
export const lambdaHandler = middy(baseHandler)
    .use(httpJsonBodyParser())
    .use(httpErrorHandler())
    .use(logMetrics(metrics))
    .use(captureLambdaHandler(tracer));