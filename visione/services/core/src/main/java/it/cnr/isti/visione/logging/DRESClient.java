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
		double timestamp = 1753.385;
		long time = (long) (timestamp*1000); //Tools.convertTimeToVBSFormat(timestamp);
		int frameNumber = 35460;
		System.out.println(time);
		//time = "00:29:13:10";

		DRESClient client = new DRESClient();

//		client.dresSubmitResultByFrameNumber(videoId, frameNumber);
		try {
			client.dresSubmitResultByTime(videoId, time, time);
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
            System.out.println("-->DRES:login successful");
            System.out.println("user: " + login.getUsername());
            System.out.println("role: " + login.getRole().getValue());
            System.out.println("session: " + login.getSessionId());

            //store session token for future requests
            sessionId = login.getSessionId();
            saveSessionInfo(sessionId, login.getUsername(), Settings.MEMBER_ID, login.getRole().getValue());
        } catch (ApiException e) {

            if (e.getCause() instanceof ConnectException) {
                System.err.println("-->DRES: Could not connect to " + Settings.SUBMIT_SERVER + ", exiting");
            } else {
                System.err.println("-->DRES: Error during login request: '" + e.getMessage() + "', exiting");
            }
        } catch (IOException e) {
            System.err.println("Error, unable to write DRES logging info file for sessionId " + sessionId);
			e.printStackTrace();
		}
	}

	public String getSessionId() {
		return sessionId;
	}

	public String getEvaluationId() {
		List<ApiClientEvaluationInfo> currentRuns;
		try {
		currentRuns = runInfoApi.getApiV2ClientEvaluationList(sessionId);
		} catch (Exception e) {
			System.out.println("-->DRES: Error during request: '" + e.getMessage() + "', exiting");
		return e.getMessage();
		}

		System.out.println("Found " + currentRuns.size() + " ongoing evaluation runs");

		for (ApiClientEvaluationInfo run : currentRuns) {
		System.out.println(run.getName() + " (" + run.getId() + "): " + run.getStatus());
		if (run.getTemplateDescription() != null) {
			System.out.println(run.getTemplateDescription());
		}
		System.out.println();
		}

		String evaluationId=null;
		ApiClientEvaluationInfo firstRun= currentRuns.stream().filter(evaluation -> evaluation.getStatus() == ApiEvaluationStatus.ACTIVE).findFirst().orElseGet(null);
		if(firstRun!=null){
			evaluationId=firstRun.getId();
		}
		
		//print evaluation id
		//evaluationId="5ffa5b86-a0d4-47cf-93cb-cb320180cd5e"; 
		System.out.println("-->DRES: Using evaluationId: " + evaluationId);
		return evaluationId;
		}



		public String dresSubmitLSC(String imagefilename) throws ApiException {//used in KIS and AVS Tasks in LSC
			System.out.println("Submission to DRES (SessionId: " + sessionId + ")");
			String evaluationId = getEvaluationId();
			System.out.println("Submitting " + imagefilename );
			SuccessfulSubmissionsStatus submissionResponse = null;
			try {
				submissionResponse = submissionApi.postApiV2SubmitByEvaluationId(evaluationId,
						new ApiClientSubmission().addAnswerSetsItem(
							new ApiClientAnswerSet().addAnswersItem(
								new ApiClientAnswer()
									.mediaItemName(imagefilename)
									.start((long) 0) //start time in milliseconds
									.end((long) 0)
							)
						), sessionId);
			} catch (ApiException e) {
				String message = "";
				ErrorMessages errorMessage = gson.fromJson(e.getResponseBody(), ErrorMessages.class);
				switch (e.getCode()) {
					case 401: {
						message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There was an authentication error during the submission. Check the session id.";
						System.err.println(message);
						throw new ApiException(message);
					}
					case 404: {
						message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There is currently no active task which would accept submissions.";
						System.err.println(message);
						break;
					}
					case 412: {
						message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". The submission was rejected by the server";
						System.err.println(message);
						break;
					}
					default: {
						message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ".Something unexpected went wrong during the submission";
						System.err.println(message);                }
				}
				return message;
			}
	
			if (submissionResponse  != null && submissionResponse.getStatus()) {
				System.out.println("-->DRES: The submission was successfully sent to the server.");
			}
			return submissionResponse.getDescription();
		}

	public String dresSubmitResultByTime(String video, long startTime, long endTime) throws ApiException {//used in KIS and AVS Tasks
        System.out.println("Submission to DRES (SessionId: " + sessionId + ")");
		String evaluationId = getEvaluationId();
		System.out.println("Submitting " + video + " @ start: " + startTime + " - end:"+endTime);
		SuccessfulSubmissionsStatus submissionResponse = null;
        try {
        	submissionResponse = submissionApi.postApiV2SubmitByEvaluationId(evaluationId,
                    new ApiClientSubmission().addAnswerSetsItem(
                        new ApiClientAnswerSet().addAnswersItem(
                            new ApiClientAnswer()
                                .mediaItemName(video)
                                .start(startTime) //start time in milliseconds
								.end(endTime)
                        )
                    ), sessionId);
        } catch (ApiException e) {
        	String message = "";
            ErrorMessages errorMessage = gson.fromJson(e.getResponseBody(), ErrorMessages.class);
            switch (e.getCode()) {
                case 401: {
                	message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There was an authentication error during the submission. Check the session id.";
                    System.err.println(message);
                    throw new ApiException(message);
                }
                case 404: {
                    message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There is currently no active task which would accept submissions.";
                    System.err.println(message);
                    break;
                }
                case 412: {
                	message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". The submission was rejected by the server";
                    System.err.println(message);
                    break;
                }
                default: {
                	message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ".Something unexpected went wrong during the submission";
                    System.err.println(message);                }
            }
            return message;
        }

        if (submissionResponse  != null && submissionResponse.getStatus()) {
            System.out.println("-->DRES: The submission was successfully sent to the server.");
        }
        return submissionResponse.getDescription();
	}

	public String dresSubmitTextAnswer(String userAnswer) throws ApiException { //used in Question Aswering Tasks
        System.out.println("Submission to DRES (SessionId: " + sessionId + ")");
		String evaluationId = getEvaluationId();
        System.out.println("Submitting userAnswer");
		SuccessfulSubmissionsStatus submissionResponse = null;
        try {
        	submissionResponse = submissionApi.postApiV2SubmitByEvaluationId(evaluationId,
                    new ApiClientSubmission().addAnswerSetsItem(
                        new ApiClientAnswerSet().addAnswersItem(
                            new ApiClientAnswer()
                                .text(userAnswer)
                        )
                    ), sessionId);
        } catch (ApiException e) {
        	String message = "";
            ErrorMessages errorMessage = gson.fromJson(e.getResponseBody(), ErrorMessages.class);
            switch (e.getCode()) {
                case 401: {
                	message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There was an authentication error during the submission. Check the session id.";
                    System.err.println(message);
                    throw new ApiException(message);
                }
                case 404: {
                    message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ". There is currently no active task which would accept submissions.";
                    System.err.println(message);
                    break;
                }
                case 412: {
                	message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ".";
                    System.err.println(message);
                    break;
                }
                default: {
                	message = "-->DRES: Error " + e.getCode() + " " +  e.getMessage() + ","  + errorMessage.description + ".Something unexpected went wrong during the submission";
                    System.err.println(message);                }
            }
            return message;
        }

        if (submissionResponse  != null && submissionResponse.getStatus()) {
            System.out.println("-->DRES: The submission was successfully sent to the server.");
        }
        return submissionResponse.getDescription();
	}

	// public void dresSubmitQuery(QueryEventLog eventLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
	// 	DresQueryLogging queryLogging = new DresQueryLogging(eventLog);
    //     new Thread(queryLogging).start();
	// }

	public void dresSubmitLog(QueryResultLog resultLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
		DresResultsLogging resultLogging = new DresResultsLogging(resultLog, getSessionId(), getEvaluationId());
        new Thread(resultLogging).start();
	}

	public SuccessStatus dresLogout() throws ApiException {
		 SuccessStatus logout = null;

		try {
		logout = userApi.getApiV2Logout(sessionId);
		} catch (ApiException e) {
			System.err.println("-->DRES: Error during request: '" + e.getMessage() + "'");
		}

		if (logout != null && logout.getStatus()) {
			System.out.println("-->DRES: Successfully logged out");
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

	// private class DresQueryLogging implements Runnable { //FIXME

	// 	QueryEventLog eventLog;

	// 	public DresQueryLogging(QueryEventLog eventLog) {
	// 		this.eventLog = eventLog;
	// 	}

	// 	public String submitQuery(QueryEventLog eventLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
	//         SuccessStatus res = null;
	// 		try {
	//            res = logApi.postApiV2LogQuery(sessionId, eventLog);
	//         } catch (ApiException e) {
	//         	String message = "Error during request: '" + e.getMessage() + "'";
	//             System.err.println(message);
	//             return message;
	//         }
	//         return res.getDescription();
	// 	}

	//     @Override
	//     public void run() {
	//     	try {
	// 			String res = submitQuery(eventLog);
	// 	        System.out.println(res);
	// 		} catch (KeyManagementException | NumberFormatException | NoSuchAlgorithmException e) {
	// 			// TODO Auto-generated catch block
	// 			e.printStackTrace();
	// 		}
	//     }
	// }


	private class DresResultsLogging implements Runnable {

		QueryResultLog resultsLog;
		String sessionId;
		String evaluationId;

		public DresResultsLogging(QueryResultLog resultsLog, String sessionId,String evaluationId) {
			this.resultsLog = resultsLog;
			this.sessionId = sessionId;
			this.evaluationId = evaluationId;
		}

		public String submitResults() throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
	        SuccessStatus res = null;
			try {
	           //res = logApi.postApiV2LogResult(sessionId, resultsLog);
			   	res= logApi.postApiV2LogResultByEvaluationId(
                        evaluationId,
                        sessionId,
						resultsLog
                );
				//System.out.println("--->LogResults sent to DRES");
	        } catch (ApiException e) {
	        	String message = "-->DRES: Error during request: '" + e.getMessage() + "'";
	            System.err.println(message);
	            return message;
	        }
	        return res.getDescription();
		}

	    @Override
	    public void run() {
	    	try {
				String res = submitResults();
		        System.out.println("-->DRES: "+res);
			} catch (KeyManagementException | NumberFormatException | NoSuchAlgorithmException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
	    }
	}

}
