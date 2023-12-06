package it.cnr.isti.visione.logging;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.ConnectException;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.util.List;

import org.openapitools.client.model.*;

import com.google.gson.Gson;

import dev.dres.ApiClient;
import dev.dres.ApiException;
import dev.dres.client.EvaluationClientApi;
import dev.dres.client.LogApi;
import dev.dres.client.SubmissionApi;
import dev.dres.client.UserApi;
import it.cnr.isti.visione.services.Settings;

public class DRESClient {
	
	private UserApi userApi;
	private EvaluationClientApi runInfoApi;
	private SubmissionApi submissionApi;
	private LogApi logApi;
	private String sessionId;
	private Gson gson = new Gson();
	private File LOGGING_FOLDER_DRES;

	
	public static void main(String[] args) {
		String videoId = "06809";
		String timestamp = "1753.385";
		String time = Tools.convertTimeToVBSFormat(timestamp);
		int frameNumber = 35460;
		System.out.println(time);
		time = "00:29:13:10";
		
		DRESClient client = new DRESClient();
		
//		client.dresSubmitResultByFrameNumber(videoId, frameNumber);
		try {
			client.dresSubmitResultByTime(videoId, time);
		} catch (ApiException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}
	
	public DRESClient() {
		
		LOGGING_FOLDER_DRES = new File(Settings.LOG_FOLDER_DRES);

		ApiClient client = new ApiClient().setBasePath(Settings.SUBMIT_SERVER);

        //initialize user api client
        userApi = new UserApi(client);

        //initialize evaluation run info client
        runInfoApi = new EvaluationClientApi(client);

        //initialize submission api client
        submissionApi = new SubmissionApi(client);

        //initialize logging api client
        logApi = new LogApi(client);

        System.out.println("Trying to log in to '" + Settings.SUBMIT_SERVER + "' with user '" + Settings.SUBMIT_USER + "'");

        //login request
        ApiUser login = null;
        try {
            login = userApi.postApiV2Login(new LoginRequest().username(Settings.SUBMIT_USER).password(Settings.SUBMIT_PWD));
            System.out.println("login successful");
            System.out.println("user: " + login.getUsername());
            System.out.println("role: " + login.getRole().getValue());
            System.out.println("session: " + login.getSessionId());

            //store session token for future requests
            sessionId = login.getSessionId();
            saveSessionInfo(sessionId, login.getUsername(), Settings.MEMBER_ID, login.getRole().getValue());
        } catch (ApiException e) {

            if (e.getCause() instanceof ConnectException) {
                System.err.println("Could not connect to " + Settings.SUBMIT_SERVER + ", exiting");
            } else {
                System.err.println("Error during login request: '" + e.getMessage() + "', exiting");
            }
        } catch (IOException e) {
            System.err.println("Error, unable to write DRES logging info file for sessionId " + sessionId);
			e.printStackTrace();
		}
	}
	
	public String getSessionId() {
		return sessionId;
	}
	
	public String dresSubmitResultByTime(String video, String timestamp) throws ApiException {
        SuccessfulSubmissionsStatus res = null;
        System.out.println("submitting " + video + " @ " + timestamp);
        List<ApiEvaluationInfo> currentRuns;
        currentRuns = runInfoApi.getApiV2ClientEvaluationList(sessionId);
        String evaluationId = currentRuns.stream().filter(evaluation -> evaluation.getStatus() == ApiEvaluationStatus.ACTIVE).findFirst().orElseGet(null).getId();

        try {
	        //TODO
        	/*res = submissionApi.getApiV1Submit(
	                null, //does not usually need to be set
	                video, //item which is to be submitted
                    null, //in case the task is not targeting a particular content object but plaintext
                    null, // for items with temporal components, such as video
                    null,  // only one of the time fields needs to be set.
                    timestamp, //in this case, we use the timestamp in the form HH:MM:SS:FF
	                sessionId
	        );*/
        	res = submissionApi.postApiV2SubmitByEvaluationId(evaluationId,
                    new ApiClientSubmission().addAnswerSetsItem(
                        new ApiClientAnswerSet().addAnswersItem(
                            new ApiClientAnswer()
                                .mediaItemId(video) //item which is to be submitted
                                .start(Long.parseLong(timestamp)) //start time in milliseconds
                        )
                    ), sessionId);
        } catch (ApiException e) {
        	String message = "";
            ErrorMessages errorMessage = gson.fromJson(e.getResponseBody(), ErrorMessages.class);
            switch (e.getCode()) {
                case 401: {
                	message = "Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There was an authentication error during the submission. Check the session id.";
                    System.err.println(message);
                    throw new ApiException(message);
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

	//TODO Remove its call in VBSService
	public String dresSubmitResultByFrameNumber(String video, int frameNumber) throws ApiException {
		return null;
	}
	
	/*public String dresSubmitResultByFrameNumber(String video, int frameNumber) throws ApiException {
        SuccessfulSubmissionsStatus res = null;
        System.out.println("submitting " + video + " @ frame " + frameNumber);
        try {
	        //TODO
        	res = submissionApi.getApiV1Submit(
	                null, //does not usually need to be set
	                video, //item which is to be submitted
                    null, //in case the task is not targeting a particular content object but plaintext
                    frameNumber, // for items with temporal components, such as video
                    null,  // only one of the time fields needs to be set.
                    null, //in this case, we use the timestamp in the form HH:MM:SS:FF
	                sessionId
	        );
        	res = submissionApi.postApiV2SubmitByEvaluationId(evaluationId,
                    new ApiClientSubmission().addAnswerSetsItem(
                        new ApiClientAnswerSet().addAnswersItem(
                            new ApiClientAnswer()
                                .mediaItemId("some_item_name"). //item which is to be submitted
                                .start(10_000L) //start time in milliseconds
                        )
                    ), sessionId);
        } catch (ApiException e) {
        	String message = "";
            ErrorMessages errorMessage = gson.fromJson(e.getResponseBody(), ErrorMessages.class);
            switch (e.getCode()) {
                case 401: {
                	message = "Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There was an authentication error during the submission. Check the session id.";
                    System.err.println(message);
                    throw new ApiException(message);
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
	}*/
	
	public void dresSubmitQuery(QueryEventLog eventLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
		DresQueryLogging queryLogging = new DresQueryLogging(eventLog);
        new Thread(queryLogging).start();
	}
	
	public void dresSubmitLog(QueryResultLog resultLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
		DresResultsLogging resultLogging = new DresResultsLogging(resultLog);
        new Thread(resultLogging).start();
	}
	
	public SuccessStatus dresLogout() throws ApiException {
		 SuccessStatus logout = null;

//         logout = userApi.getApiLogout(sessionId);
         logout = userApi.getApiV2Logout(sessionId);

        if (logout.getStatus()) {
            System.out.println("Successfully logged out");
        }
        return logout;
	}
	
	
	
	public synchronized void saveSessionInfo(String sessionId, String username, String memberID, String role) throws IOException {		
		if (!LOGGING_FOLDER_DRES.exists())
			LOGGING_FOLDER_DRES.mkdir();
		String text = "{\"session_id\": \"" + sessionId + "\", \"username\": \"" + username + "\", \"memberID\": \"" + memberID  + "\" , \"role\": \"" + role + "\" }";
		long time = System.currentTimeMillis();
		try (BufferedWriter writer = new BufferedWriter(new FileWriter(new File(LOGGING_FOLDER_DRES, "session_" + time + ".json")))) {
			writer.write(text.toString());
		}
		
	}
	
	private class DresQueryLogging implements Runnable {
		
		QueryEventLog eventLog;
		
		public DresQueryLogging(QueryEventLog eventLog) {
			this.eventLog = eventLog;
		}
		
		public String submitQuery(QueryEventLog eventLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
	        SuccessStatus res = null;
			try {
	           res = logApi.postApiV2LogQuery(sessionId, eventLog);
	        } catch (ApiException e) {
	        	String message = "Error during request: '" + e.getMessage() + "'";
	            System.err.println(message);
	            return message;
	        }
	        return res.getDescription();
		}

	    @Override
	    public void run() {
	    	try {
				String res = submitQuery(eventLog);
		        System.out.println(res);
			} catch (KeyManagementException | NumberFormatException | NoSuchAlgorithmException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
	    }
	}
	
	
	private class DresResultsLogging implements Runnable {
		
		QueryResultLog resultsLog;
		
		public DresResultsLogging(QueryResultLog resultsLog) {
			this.resultsLog = resultsLog;
		}
		
		public String submitResults(QueryResultLog resultsLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
	        SuccessStatus res = null;
			try {
	           res = logApi.postApiV2LogResult(sessionId, resultsLog);
	        } catch (ApiException e) {
	        	String message = "Error during request: '" + e.getMessage() + "'";
	            System.err.println(message);
	            return message;
	        }
	        return res.getDescription();
		}

	    @Override
	    public void run() {
	    	try {
				String res = submitResults(resultsLog);
		        System.out.println(res);
			} catch (KeyManagementException | NumberFormatException | NoSuchAlgorithmException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
	    }
	}
	
}
