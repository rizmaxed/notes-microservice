export const getUserId = (headers) => {
    return headers["App-User-Id"];
};

export const getUserName = (headers) => {
    return headers["App-User-Name"];
};

export const getIdToken = (headers) => {
    return headers.Authorization;
};

export const getResponseHeaders = () => {
    return {
        'Access-Control-Allow-Origin': '*'
    };
};
