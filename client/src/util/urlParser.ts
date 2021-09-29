import store from '@/store';

export default function(payload: any) {
    if (['patch', 'put'].includes(payload.method))
        payload.path.push(payload.body['_id']);

    let path = '';
    if (payload.path) path = '/' + payload.path.join('/');

    if (store.state.system_user
        && store.state.system_user['attributes']['name'] === 'admin'
        && payload.model !== 'company')
        payload.query = {
            ...payload.query,
            companyId: store.state.selectedCompany,
        };
    let query = '';
    if (payload.query) query = '?' + Object.keys(payload.query).map(x => x + '=' + payload.query[x]).join('&');

    payload['url'] = `/${payload.model + path + query}`;
    return payload;
}
