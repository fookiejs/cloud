import { request } from './request';
import axios from 'axios';

export default async function(model:any,body: any,ctx:any) {
    for (let key of Object.keys(body)) {
        if (
                ['integer', 'number', 'float'].includes(
                        model.schema[key].type,
                )
        ) {
            body[key] = parseInt(body[key]);
        } else if (model.schema[key].input === 'phone') {
            body[key] = body[key].replace(/[\(\)\- ]+/g, '');
        } else if (model.schema[key].input === 'file') {
            let file = body[key];
            if (!file) return;
            let q;
            if (ctx.state.system_user && ctx.state.system_user['attributes']['name'] === 'admin')
                q = '&companyId=' + ctx.state.selectedCompany;
            let uri = `/file?extension=${/[^.]+$/.exec(file.name)}`;
            if (q) uri += q;
            let { data: { path, url } } = await request.get(uri);
            await axios.put(url, file);
            body[key] = 'https://static.servisizle.com/' + path;
        }
    }
}