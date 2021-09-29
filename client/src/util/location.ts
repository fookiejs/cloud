import Location from 'aws-sdk/clients/location';
import { Auth } from 'aws-amplify';

export const awsLocation = async () => new Location({
    credentials: await Auth.currentUserCredentials(),
    region: 'us-east-2',
});
