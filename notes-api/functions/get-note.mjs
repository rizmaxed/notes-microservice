import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
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
    const note_id = decodeURIComponent(event.pathParameters.note_id);

    logger.info('Retrieving note by ID', { note_id });

    tracer.putAnnotation('operation', 'getNoteById');
    tracer.putAnnotation('note_id', note_id);
    tracer.putMetadata('requestParams', event.pathParameters);

    const params = {
        TableName: tableName,
        IndexName: 'note_id-index',
        KeyConditionExpression: 'note_id = :note_id',
        ExpressionAttributeValues: {
            ':note_id': note_id
        },
        Limit: 1
    };

    const result = await dynamodb.send(new QueryCommand(params));
    const items = result.Items || [];

    if (items.length > 0) {
        metrics.addDimension('user_id', items[0].user_id);
        metrics.addMetric('NoteFetched', MetricUnit.Count, 1);

        tracer.putAnnotation('user_id', items[0].user_id);
        tracer.putMetadata('fetchedNote', items[0]);

        return {
            statusCode: 200,
            headers: util.getResponseHeaders(),
            body: JSON.stringify(items[0])
        };
    } else {
        logger.warn('Note not found', { note_id });

        return {
            statusCode: 404,
            headers: util.getResponseHeaders()
        };
    }
};

export const lambdaHandler = middy(baseHandler)
    .use(httpErrorHandler()) // error formatting
    .use(logMetrics(metrics)) // auto-publish metrics
    .use(captureLambdaHandler(tracer)) // X-Ray tracing
    .before((request) => {
        logger.addContext(request.context); // contextual logging
    });