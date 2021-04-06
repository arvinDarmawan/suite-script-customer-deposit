/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

define(['N/runtime', 'N/record', 'N/search', 'N/format', 'N/error'], function (runtime, record, search, format, error) {
    function doValidation(args, argNames, methodName) {
        for (var i = 0; i < args.length; i++)
            if (!args[i] && args[i] !== 0)
                throw error.create({
                    name: 'MISSING_REQ_ARG',
                    message: 'Missing a required argument: [' + argNames[i] + '] for method: ' + methodName
                });
    }
    
    function searchCustomer(name){
		var itemArray = [];
		log.debug('ss customer id',name);
		//if (tipe.toUpperCase()=="USER"){
		   	 var arrSearchResults=search.create({
		  	      type:search.Type.CUSTOMER,
		  	      columns:['internalid','entityid','companyname','custentity_wsb_user_id_field'],
		  	      filters:[
		  	                ['custentity_wsb_user_id_field',search.Operator.IS,name]
		  	                 //,'and',['category',search.Operator.ANYOF,[1]]//User=1
		  	               ]
		  	    }).run();

		 if (arrSearchResults)
	   	 {
	   		 itemArray =arrSearchResults.getRange(0,5);
	   		 log.debug('search customer',itemArray);
	   		 return itemArray;
	   	 }else{
	   		 return;
	   	 }
	}

    function doGet(requestParams) {
		doValidation([requestParams.recordtype, requestParams.externalid], ['recordtype', 'externalid'], 'GET');
        // will update this code later
    }

    function doPost(restletBody) {
        doValidation([restletBody.recordtype,restletBody.data], ['recordtype','data'], 'POST');
        log.debug('Number of queues available:', runtime.queueCount);
    	var script = runtime.getCurrentScript();
	    log.debug({
	        "title": "Governance Monitoring",
	        "details": "Remaining Usage = " + script.getRemainingUsage()
	    });

        var restletData = restletBody.data;
        doValidation([restletData.customerid,restletData.amount, restletData.account], ['customerid','amount', 'account'], 'POST');

        var customerid = restletData.customerid.trim();
        var amount = restletData.amount;
        var account = restletData.account;
        var journalEntry = restletData.journalEntry;

        // search customer
        var objSearchCustomer = searchCustomer(customerid);
        log.debug({
            "title": "Check if exists: Customer " + objSearchCustomer.length,
            "details": objSearchCustomer
        });

        if(objSearchCustomer.length === 0){
            throw error.create({
                name: 'CUSTOMER_NOT_FOUND',
                message: 'Customer ' + customerid + ' not found in the data'
            });
        }

        var customerInternalID = objSearchCustomer[0].getValue({
            name: "internalid"
        });

        try {
            // create customer deposit and set the value
            var customerDeposit = record.create({
                type: record.Type.CUSTOMER_DEPOSIT,
                isDynamic: true,
                defaultValues: {
                    entity: customerInternalID
                }
            });
            customerDeposit.setValue({ fieldId: 'payment', value: amount });
            customerDeposit.setText({ fieldId: 'account', text: account });

            // create journal entry and set the value
            if(journalEntry){
                doValidation([journalEntry.details,journalEntry.trandate, journalEntry.memo], ['details','trandate', 'memo'], 'POST');

                var journalEntryDetails = journalEntry.details;
                var trandate = journalEntry.trandate;
                var memo = journalEntry.memo;

                var data = record.create({
                    type: record.Type.JOURNAL_ENTRY,
                    isDynamic: true
                });
                data.setValue('trandate',format.parse({ value : trandate, type : format.Type.DATE}));
                data.setValue('memo',memo);

                for (var i = 0; i < journalEntryDetails.length; i++) {
                    data.selectNewLine('line');
                    //Set the value for the field in the currently selected line.
                    data.setCurrentSublistText('line','account', journalEntryDetails[i].account);
                    data.setCurrentSublistValue('line',journalEntryDetails[i].type, journalEntryDetails[i].amount);
    
                    //Commits the currently selected line on a sublist.
                    data.commitLine('line');
                }

                //save the record.
                data.save();
            }

            
            var id = customerDeposit.save({
                enableSourcing: false,
                ignoreMandatoryField: false
            });

            return JSON.parse(JSON.stringify({
                customerDeposit: {
                    id: id,
                    entity: customerInternalID,
                    account: account
                }
            }));

       } catch(err){
            log.error({
                "title": "Error",
                "details": err.toString()
            });

            throw error.create({
                name: 'INTERNAL_ERROR',
                message:  err.toString()
            });
       }
    }


    return {
        get: doGet,
        // put : doPut,
        post: doPost
    };

});