exports.handler = async () => {
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Lambda OK depuis API Gateway !" })
    };
};
