const { ServiceBroker } = require("moleculer");
const { MongoClient } = require('mongodb');

/* 
jest.mock('aws-sdk', () => {
    const upload = jest.fn();
    const aws = class FakeAWS { };
    aws.S3 = class FakeS3 {
        // eslint-disable-next-line class-methods-use-this
        upload(...args) {
            this.uploaded = this.uploaded || [];
            this.uploaded.push(args);
            return new class FakeMediaUpload {
                // eslint-disable-next-line class-methods-use-this
                promise() {
                    return Promise.resolve(...args);
                }
            }
        }
    };
    return aws;
});
*/

const TestService = require("../../src");

describe("Test 'image-storage' service", () => {
    const broker = new ServiceBroker();
    broker.createService(TestService);
    const mongoClient = new MongoClient(process.env.MONGO_DSN);

    beforeAll(async () => {
        broker.start();
        await mongoClient.connect();
        await mongoClient.db().collection(TestService.settings.collection).remove();
    });
    afterAll(async () => {
        await mongoClient.close();
        broker.stop();
    });

    describe("Test image-storage.putImage", () => {

        it("should upload Image", async () => {
            const result = await broker.call("image-storage.put", {
                url: 'https://www.google.com',
                width: 800,
                data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==',
            });

            expect(result).toEqual(true);

            const list600 = await broker.call("image-storage.list", {
                url: 'https://www.google.com',
                width: 600,
            });
            expect(list600).toEqual([]);

            const list800 = await broker.call("image-storage.list", {
                url: 'https://www.google.com',
                width: 800,
            });

            expect(list800).toEqual([
                expect.stringMatching(/^\w{8}-\w{4}-\w{4}-\w{4}-\w{6}$/),
            ]);

            const list800a = await broker.call("image-storage.list", {
                url: 'https://www.google.com/', // backslash
                width: 800,
            });
            expect(list800a).toEqual([]);
        });
    });
});
