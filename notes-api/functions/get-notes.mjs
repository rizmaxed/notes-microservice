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
    const query = event.queryStringParameters || {};
    const limit = query.limit ? parseInt(query.limit) : 5;
    const user_id = util.getUserId(event.headers);

    logger.info('Fetching notes list', {
        user_id,
        limit,
        start: query.start
    });

    tracer.putAnnotation('operation', 'listNotes');
    tracer.putAnnotation('user_id', user_id);
    tracer.putMetadata('queryParams', query);

    const params = {
        TableName: tableName,
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: {
            ':uid': user_id
        },
        Limit: limit,
        ScanIndexForward: false // newest first
    };

    const startTimestamp = query.start ? parseInt(query.start) : 0;
    if (startTimestamp > 0) {
        params.ExclusiveStartKey = {
            user_id,
            ts: startTimestamp
        };
    }

    const result = await dynamodb.send(new QueryCommand(params));
    const items = result.Items || [];

    tracer.putMetadata('notesList', items);

    metrics.addDimension('user_id', user_id);
    metrics.addMetric('NotesListed', MetricUnit.Count, items.length);

    return {
        statusCode: 200,
        headers: util.getResponseHeaders(),
        body: JSON.stringify(result)
    };
};

export const lambdaHandler = middy(baseHandler)
    .use(httpErrorHandler())
    .use(logMetrics(metrics))
    .use(captureLambdaHandler(tracer))
    .before((request) => {
        logger.addContext(request.context);
    });