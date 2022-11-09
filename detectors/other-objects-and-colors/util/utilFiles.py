import os


def get_filenames(folder, count, filenames):
    # print(f"Analyzing {folder} folder")
    listfiles = os.listdir(folder)
    for fname in listfiles:
        full_fname = folder + '/' + fname
        if os.path.isdir(full_fname):  # It is a directory
            count, filenames = get_filenames(full_fname, count, filenames)
        # elif tarfile.is_tarfile(full_fname):  # It is a tar folder
        #     f = tarfile.open(full_fname)
        #     for sub_f in f:
        #         get_filenames(sub_f, count, filenames)
        elif os.path.isfile(full_fname):  # It is a normal file
            count += 1
            filenames.append(full_fname)
            if count % 10000 == 0:
                print(f"..{count}---- files found till now.. %")
        else:  # print("It is a special file (socket, FIFO, device file)")
            # filename not an image file
            print(f"--Skipping {full_fname} as it is not recognized as an image")
    return count, filenames
