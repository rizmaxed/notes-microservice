import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
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
    const user_id = util.getUserId(event.headers);
    const ts = parseInt(event.pathParameters.ts);

    logger.info('Deleting note', { user_id, ts });

    const params = {
        TableName: tableName,
        Key: {
            user_id,
            ts
        }
    };

    await dynamodb.send(new DeleteCommand(params));

    // Powertools Metrics
    metrics.addDimension('user_id', user_id);
    metrics.addMetric('NoteDeleted', MetricUnit.Count, 1);

    // Powertools Tracer Annotations and Metadata for X-Ray
    tracer.putAnnotation('operation', 'deleteNote');
    tracer.putAnnotation('user_id', user_id);
    tracer.putMetadata('deletedNote', { ts });

    return {
        statusCode: 200,
        headers: util.getResponseHeaders()
    };
};

export const lambdaHandler = middy(baseHandler)
    .use(httpErrorHandler()) // gracefully handle errors
    .use(logMetrics(metrics)) // auto-publish custom metrics
    .use(captureLambdaHandler(tracer)) // auto-capture trace data
    .before((request) => {
        logger.addContext(request.context);
    });