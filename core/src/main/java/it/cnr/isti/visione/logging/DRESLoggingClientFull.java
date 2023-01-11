package it.cnr.isti.visione.logging;

import java.net.ConnectException;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;

import org.openapitools.client.model.ClientRunInfo;
import org.openapitools.client.model.ClientRunInfoList;
import org.openapitools.client.model.LoginRequest;
import org.openapitools.client.model.QueryEventLog;
import org.openapitools.client.model.QueryResultLog;
import org.openapitools.client.model.SuccessStatus;
import org.openapitools.client.model.SuccessfulSubmissionsStatus;
import org.openapitools.client.model.UserDetails;

import com.google.gson.Gson;

import dev.dres.ApiClient;
import dev.dres.ApiException;
import dev.dres.client.ClientRunInfoApi;
import dev.dres.client.LogApi;
import dev.dres.client.SubmissionApi;
import dev.dres.client.UserApi;
import it.cnr.isti.visione.services.Settings;

public class DRESLoggingClientFull {
	
	private UserApi userApi;
	private ClientRunInfoApi runInfoApi;
	private SubmissionApi submissionApi;
	private LogApi logApi;
	private String sessionId;
	private Gson gson = new Gson();

	
	
	public DRESLoggingClientFull() {

		ApiClient client = new ApiClient().setBasePath(Settings.SUBMIT_SERVER);

        //initialize user api client
        userApi = new UserApi(client);

        //initialize evaluation run info client
        runInfoApi = new ClientRunInfoApi(client);

        //initialize submission api client
        submissionApi = new SubmissionApi(client);

        //initialize logging api client
        logApi = new LogApi(client);

        System.out.println("Trying to log in to '" + Settings.SUBMIT_SERVER + "' with user '" + Settings.SUBMIT_USER + "'");

        //login request
        UserDetails login = null;
        try {
            login = userApi.postApiV1Login(new LoginRequest().username(Settings.SUBMIT_USER).password(Settings.SUBMIT_PWD));
            System.out.println("login successful");
            System.out.println("user: " + login.getUsername());
            System.out.println("role: " + login.getRole().getValue());
            System.out.println("session: " + login.getSessionId());

            //store session token for future requests
            sessionId = login.getSessionId();
        } catch (ApiException e) {

            if (e.getCause() instanceof ConnectException) {
                System.err.println("Could not connect to " + Settings.SUBMIT_SERVER + ", exiting");
            } else {
                System.err.println("Error during login request: '" + e.getMessage() + "', exiting");
            }
        }
	}

	
	public String dresFullSubmit(String video, String frame, String shot, QueryEventLog eventLog, QueryResultLog resultLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
		/*ApiClient client = new ApiClient().setBasePath(Settings.SUBMIT_SERVER);

        //initialize user api client
        userApi = new UserApi(client);

        //initialize evaluation run info client
        runInfoApi = new ClientRunInfoApi(client);

        //initialize submission api client
        submissionApi = new SubmissionApi(client);

        //initialize logging api client
        logApi = new LogApi(client);

        System.out.println("Trying to log in to '" + Settings.SUBMIT_SERVER + "' with user '" + Settings.SUBMIT_USER + "'");

        //login request
        UserDetails login = null;
        try {
            login = userApi.postApiLogin(new LoginRequest().username(Settings.SUBMIT_USER).password(Settings.SUBMIT_PWD));
            System.out.println("login successful");
            System.out.println("user: " + login.getUsername());
            System.out.println("role: " + login.getRole().getValue());
            System.out.println("session: " + login.getSessionId());

            //store session token for future requests
            sessionId = login.getSessionId();
        } catch (ApiException e) {

            if (e.getCause() instanceof ConnectException) {
                System.err.println("Could not connect to " + Settings.SUBMIT_SERVER + ", exiting");
            } else {
                System.err.println("Error during login request: '" + e.getMessage() + "', exiting");
            }
        }*/
		
		String res = null;
		


        ClientRunInfoList currentRuns = null;
        try {
            currentRuns = runInfoApi.getApiV1ClientRunInfoList(sessionId);
        } catch (ApiException e) {
            System.err.println("Error during request: '" + e.getMessage() + "', exiting");
            return null;
        }

        System.out.println("Found " + currentRuns.getRuns().size() + " ongoing evaluation runs");

        for (ClientRunInfo run : currentRuns.getRuns()) {
            System.out.println(run.getName() + " (" + run.getId() + "): " + run.getStatus());
            if (run.getDescription() != null) {
                System.out.println(run.getDescription());
            }
            System.out.println();
        }
        
//        System.out.println(eventLog.toString());
//        System.out.println(resultLog.toString());

        SuccessfulSubmissionsStatus submissionResponse = null;
        System.out.println("submitting " + video + ", " + shot);
        try {
//	        submissionResponse = submissionApi.getSubmit(
//	                null, //does not usually need to be set
//	                video, //item which is to be submitted
//	                Integer.parseInt(frame), // for items with temporal components, such as video
//	                null,  // only one of the time fields needs to be set.
//	                null, //in this case, we use the timestamp in the form HH:MM:SS:FF
//	                sessionId
//	        );
        	
	        //TODO
	        submissionResponse = submissionApi.getApiV1Submit(
	                null, //does not usually need to be set
	                video, //item which is to be submitted
                    null, //in case the task is not targeting a particular content object but plaintext
                    null, // for items with temporal components, such as video
                    null,  // only one of the time fields needs to be set.
                    "00:00:10:00", //in this case, we use the timestamp in the form HH:MM:SS:FF
	                sessionId
	        );
        } catch (ApiException e) {
        	String message = "";
            switch (e.getCode()) {
                case 401: {
                	message = "There was an authentication error during the submission. Check the session id.";
                    System.err.println(message);
                    break;
                }
                case 404: {
                    message = "There is currently no active task which would accept submissions.";
                    System.err.println(message);
                    break;
                }
                default: {
                    message = "Something unexpected went wrong during the submission: '" + e.getMessage() + "'.";
                    System.err.println(message);
                }
            }
            return message;
        }

        if (submissionResponse != null && submissionResponse.getStatus()) {
        	res = submissionResponse.getDescription();
            System.out.println("The submission was successfully sent to the server.");
            try {
            
//                logApi.postLogQuery(sessionId, eventLog);
                logApi.postApiV1LogQuery(sessionId, eventLog);
//            System.out.println(eventLog.toString());
            if (resultLog != null) {
//            	logApi.postLogResult(sessionId, resultLog);
        		logApi.postApiV1LogResult(sessionId, resultLog);
            }
//            System.out.println(resultLog.toString());
            } catch (ApiException e) {
            	String message = "Error during request: '" + e.getMessage() + "'";
                System.err.println(message);
                return message;
            }

        }
        return res;
	}
	
	public String dresSubmitResult(String video, String timestamp) {
        SuccessfulSubmissionsStatus res = null;
        System.out.println("submitting " + video + " @ " + timestamp);
        try {
	        //TODO
        	res = submissionApi.getApiV1Submit(
	                null, //does not usually need to be set
	                video, //item which is to be submitted
                    null, //in case the task is not targeting a particular content object but plaintext
                    null, // for items with temporal components, such as video
                    null,  // only one of the time fields needs to be set.
                    timestamp, //in this case, we use the timestamp in the form HH:MM:SS:FF
	                sessionId
	        );
        } catch (ApiException e) {
        	String message = "";
            ErrorMessages errorMessage = gson.fromJson(e.getResponseBody(), ErrorMessages.class);
            switch (e.getCode()) {
                case 401: {
                	message = "Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There was an authentication error during the submission. Check the session id.";
                    System.err.println(message);
                    break;
                }
                case 404: {
                    message = "Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There is currently no active task which would accept submissions.";
                    System.err.println(message);
                    break;
                }
                case 412: {
                	message = "Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ".";
                    System.err.println(message);
                    break;
                }
                default: {
                	message = "Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ".";
                    System.err.println(message);                }
            }
            return message;
        }

        if (res != null && res.getStatus()) {
            System.out.println("The submission was successfully sent to the server.");
        }
        return res.getDescription();
	}
	
	public String dresSubmitQuery(QueryEventLog eventLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
        SuccessStatus res = null;
		try {
           res = logApi.postApiV1LogQuery(sessionId, eventLog);
        } catch (ApiException e) {
        	String message = "Error during request: '" + e.getMessage() + "'";
            System.err.println(message);
            return message;
        }
        return res.getDescription();
	}
	
	public String dresSubmitLog(QueryResultLog resultLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
		SuccessStatus res = null;    
		try {
        	res = logApi.postApiV1LogResult(sessionId, resultLog);
        } catch (ApiException e) {
        	String message = "Error during request: '" + e.getMessage() + "'";
            System.err.println(message);
            return message;
        }
        return res.getDescription();
	}
	
	public SuccessStatus dresLogout() throws ApiException {
		 SuccessStatus logout = null;

//         logout = userApi.getApiLogout(sessionId);
         logout = userApi.getApiV1Logout(sessionId);

        if (logout.getStatus()) {
            System.out.println("Successfully logged out");
        }
        return logout;
	}
	
}
