const AWS = require('aws-sdk');
const S3PathGenerator = require('s3-path-generator');
const uuidv1 = require('uuid/v1');
const { MongoClient } = require('mongodb');

module.exports = {
    name: "image-storage",

	/**
	 * Service settings
	 */
    settings: {
        collection: 'image',
    },

	/**
	 * Service dependencies
	 */
    // dependencies: [],	

	/**
	 * Actions
	 */
    actions: {

        /**
         * put
		 * @param {String} url - page url
		 * @param {String} width - image width
		 * @param {String} data - binary image content
         */
        put: {
            params: {
                url: { type: "url" },
                width: { type: "number", positive: true, integer: true },
                data: { type: "any" },
                meta: { type: "object", optional: true },
            },
            async handler(ctx) {
                const { url, width, data } = ctx.params;
                const s3bucket = new AWS.S3({
                    apiVersion: '2006-03-01',
                    credentials: {
                        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    },
                });
                const uuid = this.uuid();
                const path = S3PathGenerator.generate(url);
                const key = `${path}/${width}/${uuid}`;
                const result = await s3bucket.upload({
                    Bucket: process.env.AWS_BUCKET,
                    Key: key,
                    Body: data,
                }).promise();

                const where = {};
                where[`images.${width}`] = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: result.Key,
                    uuid,
                }
                const { value } = await this.collection.findOneAndUpdate({ url }, { '$push': where }, { upsert: true, returnOriginal: false });
                return !!value;
            },
        },

        list: {
            params: {
                url: { type: "url" },
                width: { type: "number", positive: true, integer: true },
            },
            async handler(ctx) {
                const { url, width } = ctx.params;

                const result = await this.collection.findOne({ url });
                return this.postFilter(result, width);
            },
        },
    },

	/**
	 * Events
	 */
    events: {

    },

	/**
	 * Methods
	 */
    methods: {
        uuid() {
            const msec = new Date().getTime();
            return uuidv1({
                node: this.broker.nodeID,
                msec,
            });
        },
        postFilter(record, width) {
            const images = ((record || {}).images || {})[width] || [];
            return images.map(i => i.uuid);
        },
    },

	/**
	 * Service created lifecycle event handler
	 */
    created() {
        if (!process.env.AWS_ACCESS_KEY_ID) {
            throw new Error("AWS_ACCESS_KEY_ID not set");
        }
        if (!process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error("AWS_SECRET_ACCESS_KEY not set");
        }
        if (!process.env.AWS_BUCKET) {
            throw new Error("AWS_BUCKET not set");
        }
        if (!process.env.MONGO_DSN) {
            throw new Error("MONGO_DSN not set");
        }
    },

	/**
	 * Service started lifecycle event handler
	 */
    async started() {
        this.mongoClient = new MongoClient(process.env.MONGO_DSN);
        await this.mongoClient.connect();
        this.collection = this.mongoClient.db().collection(this.settings.collection);
        this.logger.info(`Connected successfully to ${process.env.MONGO_DSN}`);
    },

	/**
	 * Service stopped lifecycle event handler
	 */
    async stopped() {
        await this.mongoClient.close();
        this.logger.info(`Successfully disconnected from ${process.env.MONGO_DSN}`);
    },
};