import pdfFonts from 'pdfmake/build/vfs_fonts';
import 'pdfmake/build/vfs_fonts.js';
import moment from 'moment';

function today() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();

    today = dd + '/' + mm + '/' + yyyy;
    return today;
},

export default async function(form: any, ctx: any) {
    let installments = [['ÖDEME', 'TUTAR', 'TARİH']];
    console.log(parseInt(form.installment));
    for (let i = 0; i < parseInt(form.installment); i++) {
        installments.push(['Ödeme günü 1-10', form.offer / parseInt(form.installment), moment().lang('tr').add(i, 'M').format('LLL')]);
    }
    pdfMake.vfs = pdfFonts.pdfMake.vfs;
    var receiptDef = {
        content: [
            {
                columns: [
                    {
                        text: 'logo',
                    },
                    {
                        text: 'Servis Senet İcmali Formu',
                    },
                    {
                        text: today(),
                    },

                ],
                margin: [0, 25],
            },
            {
                margin: [0, 25],
                layout: 'lightHorizontalLines',
                table: {
                    widths: ['*', '*', '*'],
                    body: installments,
                },
            },
            {
                margin: [0, 25],
                text: 'İş bu emre muharrer senedimin Mukabilinde `${today}` Tarihinde ${form.company.name} verihavalesine yukarıda yazılı Yalnız...${form.offer} TL ödeyeceğim bedeli nakden ahzolunmuştur. İş bu bono vadesinde ödenmediği takdirde müteakip bonoların müacelliyatı kasbedeceğini, İhtilaf vukuatında mahkemelerin selahiyetini şimdiden kabul eylerim.',
            },
            {
                margin: [0, 25],
                layout: 'lightHorizontalLines',
                table: {
                    widths: ['*', '*'],
                    body: [['AD', 'EMAIL'], [form.parent.name || '-', form.parent.email || '-']],
                },
            },
        ],
    };

    let parents = form.parents.map(p => [p.name || '-', p.phone || '-', p.email || '-']);
    parents = [['Ad', 'Telefon', 'Email'], ...parents];

    pdfMake.vfs = pdfFonts.pdfMake.vfs;
    var contractDef = {
        content: [
            {
                columns: [
                    {
                        text: 'logo',
                    },
                    {
                        text: 'Servis İzle Sözleşme Formu',
                    },
                    {
                        text: today(),
                    },

                ],
                margin: [0, 25],
            },
            {

                columns: [
                    {
                        layout: 'lightHorizontalLines', // optional
                        table: {
                            widths: ['*', '*'],
                            body: [
                                ['Öğreni Adı', form.student.name || ''],
                                ['Öğrenci Telefonu', form.student.phone || ''],
                                ['Sözleşme Tarihi', today],
                                ['Kan Grubu', form.student.bloodType || ''],
                                ['Doğum Tarihi', form.student.birthDay || ''],
                            ],
                        },
                    },
                    {
                        layout: 'lightHorizontalLines',
                        table: {
                            widths: ['*', '*'],

                            body: [
                                ['Servis Ücerti', form.offer],
                                ['Peşinat', form.advance_payment],
                                ['Gidiş Mesafesi', form.km1],
                                ['Dönüş Mesafesi', form.km2],
                                ['Toplam Mesafesi', form.km1 + form.km2],
                            ],
                        },
                    },
                ],
            },
            {
                text: 'Veli Bilgileri',
                margin: [0, 10],
            },
            {
                layout: 'lightHorizontalLines',
                table: {
                    widths: ['*', '*', '*'],
                    body: parents,
                },
            },
            {
                columns: [
                    {
                        text: 'Sabah Adresi',
                    },
                    {
                        text: 'Sabah Adresi',
                    },
                ],
                margin: [0, 30, 0, 0],
            },
            {
                columns: [
                    {
                        text: form.dayAddress,
                    },
                    {
                        text: form.nightAddress,
                    },
                ],
                margin: [0, 10],
            },
            {
                margin: [0, 30, 0, 0],
                columns: [
                    {
                        text: 'Şirket Yetlisi İmza',
                    },
                    {
                        text: 'Veli İmza',
                    },
                ],

            },
        ],
    };

    createPdf(receiptDef).download('makbuz.pdf');
    createPdf(contractDef).download('sozlesme.pdf');

    const cpg = pdfMake.createPdf(contractDef);
    const rpg = pdfMake.createPdf(receiptDef);

    cpg.getBlob(async (cblob: any) => {
        rpg.getBlob(async (rblob: any) => {
            cblob.lastModifiedDate = new Date();
            cblob.name = 'sozlesme.pdf';
            rblob.lastModifiedDate = new Date();
            rblob.name = 'senet-icmali.pdf';

            ctx.$store.dispatch('api', {
                model: 'contract',
                method: 'post',
                body: {
                    studentId: form.student._id,
                    receipt: rblob,
                    contract: cblob,
                },
            });
        });
    });
};
