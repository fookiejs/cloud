import axios from "axios";
import { Auth } from "aws-amplify";

export const request = axios.create({
  baseURL:"http://localhost:2626",
});
/*
request.interceptors.request.use(async (config) => {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    if (token) config.headers.authorization = token;
    return config;
});
*/

