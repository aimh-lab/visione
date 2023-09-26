package it.cnr.isti.visione.services;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;

public class ObjectQueryPreprocessing {
	private HashMap<String, ObjectHyperset> hypersetHM;

	private static HashSet<String> ignore = new HashSet<String>(Arrays.asList("black", "blue", "brown", "green", "grey",
			"orange", "pink", "purple", "red", "white", "yellow", "*", "colorkeyframe", "graykeyframe"));

	private class ObjectHyperset {

		private String definition;
		private String[] hyperset;
		private String classname;

		public ObjectHyperset(String hypersetText) {
			parseHyperset(hypersetText);

		}

		private void parseHyperset(String hypersetText) {
			String[] columns = hypersetText.split(";");
			this.classname = columns[0].trim();

			String hyper = columns[1].trim();
			if (!hyper.equals("")) {
				hyperset = hyper.split(",");
				for (int i = 0; i < hyperset.length; i++) {
					hyperset[i] = hyperset[i].trim();
				}
			}

			definition = columns[2];
		}

		public String getDefinition() {
			return definition;
		}

		public String[] getHyperset() {
			return hyperset;
		}

		public String getClassname() {
			return classname;
		}

	}
	
	public ObjectQueryPreprocessing(InputStream hyperset) {
		hypersetHM = new HashMap<>();
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(hyperset))) {
			String line = null;
			while ((line = reader.readLine()) != null) {
				ObjectHyperset data = new ObjectHyperset(line);
				hypersetHM.put(data.getClassname(), data);
			}
		} catch (FileNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}

	//older version getting hypersets from a file
	/*
	public ObjectQueryPreprocessing(File hypersetFile) {
		hypersetHM = new HashMap<>();
		try (BufferedReader reader = new BufferedReader(new FileReader(hypersetFile))) {
			String line = null;
			while ((line = reader.readLine()) != null) {
				ObjectHyperset data = new ObjectHyperset(line);
				hypersetHM.put(data.getClassname(), data);
			}
		} catch (FileNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
	}
	*/
	public String processingLucene(String objectTxt, String field, String occur) {
		String prefix = " " + occur + field + ":4wc";
		String prefixMinus = " -" + field + ":4wc";
		String prefixHyperset = " " + occur + field + ":4wc";
		StringBuilder res = new StringBuilder();
		StringBuilder notObj = new StringBuilder();

		String[] ssplit = objectTxt.split("\\s+");
		HashMap<String, Integer> hmObjCount = new HashMap<String, Integer>();
		for (String obj : ssplit) {
			if (obj.isEmpty())
				continue;
			if (ignore.contains(obj)) {
				res.append(prefix).append(obj);
				continue;
			}
			if (obj.startsWith("-")) {
				obj = obj.replaceAll("-", prefixMinus);
				if(!obj.matches("^.*\\d$")){
					obj+="1";
				}
				notObj.append(obj);
			} else {
				int count = hmObjCount.getOrDefault(obj, 0);
				count++;
				hmObjCount.put(obj, count);
				res.append(prefix).append(obj).append(count);

				
				res.append(prefix).append(obj).append(count);
				ObjectHyperset hypersetObj = hypersetHM.get(obj);
				if (hypersetObj != null) {
					String[] hyperset = hypersetObj.getHyperset();
					if (hyperset != null) {
						for (String hyper : hyperset) {
							int countHyp = hmObjCount.getOrDefault(hyper, 0);
							countHyp++;
							hmObjCount.put(hyper, countHyp);
							res.append(prefixHyperset).append(hyper).append(countHyp);
						}
					}
				}
			}

		}

		res.append(" ").append(notObj);
		return res.toString().trim();
	}
	

	public String processing(String objectTxt, boolean extend) {
		StringBuilder res = new StringBuilder();
		StringBuilder notObj = new StringBuilder();

		String[] ssplit = objectTxt.split("\\s+");
		HashMap<String, Integer> hmObjCount = new HashMap<String, Integer>();
		for (String obj : ssplit) {
			if (obj.isEmpty())
				continue;
			if (ignore.contains(obj)) {
				res.append(" 4wc").append(obj);
				continue;
			}
			if (obj.startsWith("-")) {
				obj = obj.replaceAll("-", "-4wc");
				if(!obj.matches("^.*\\d$")){
					obj+="1";
				}
				notObj.append(" ").append(obj);
			} else {
				int count = hmObjCount.getOrDefault(obj, 0);
				count++;
				hmObjCount.put(obj, count);
				res.append(" 4wc").append(obj).append(count);
				if (!extend)
					continue;
				res.append(" 4wc").append(obj).append(count);
				ObjectHyperset hypersetObj = hypersetHM.get(obj);
				if (hypersetObj != null) {
					String[] hyperset = hypersetObj.getHyperset();
					if (hyperset != null) {
						for (String hyper : hyperset) {
							int countHyp = hmObjCount.getOrDefault(hyper, 0);
							countHyp++;
							hmObjCount.put(hyper, countHyp);
							res.append(" 4wc").append(hyper).append(countHyp);
						}
					}
				}
			}

		}

		res.append(" ").append(notObj);
		return res.toString().trim();
	}
/*
	public static void main(String[] args) {
		File hypersetFile = new File("/media/ssd2/data/vbs2022/classname_hyperset_definition.csv");
		ObjectQueryPreprocessing objectPrerocessing = new ObjectQueryPreprocessing(hypersetFile);
		String test = "red orange person man -pers* -man";
		System.out.println(objectPrerocessing.processing(test, false));
		System.out.println(objectPrerocessing.processing(test, true));
	}
	*/
}
